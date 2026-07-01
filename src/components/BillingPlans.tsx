'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles, Zap } from 'lucide-react';

type Plan = {
  slug: string;
  name: string;
  monthly_price_brl: number;
  monthly_message_limit: number;
  overage_price_per_msg_brl: number;
};

type Subscription = {
  plan_slug: string;
  plan_name: string;
  status: string;
  is_paid: boolean;
  current_period_end: string | null;
};

type OverviewResponse = {
  subscription: Subscription | null;
  plans: Plan[];
};

function formatBrl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Destaque visual do plano do meio (mais vendido). Ordem vem do backend por preco.
const HIGHLIGHT_SLUG = 'intermediario';

// Beneficios curtos por plano (copy de vendas — nao vem do banco).
const PERKS: Record<string, string[]> = {
  basico: ['Ideal pra comecar', 'Todos os canais WhatsApp', 'Base de conhecimento'],
  intermediario: ['Melhor custo por mensagem', 'Analise de curriculos', 'Suporte prioritario'],
  avancado: ['Alto volume', 'Menor preco de excedente', 'Multiplos agentes'],
};

export function BillingPlans({ locationId }: { locationId: string }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!locationId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/billing/overview');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: OverviewResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Falha ao carregar planos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  async function subscribe(slug: string) {
    setNotice(null);
    setCheckoutSlug(slug);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_slug: slug }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          setNotice({ type: 'success', text: 'Voce ja tem uma assinatura ativa.' });
        } else {
          setNotice({
            type: 'error',
            text: json?.detail || json?.error || 'Nao foi possivel iniciar a assinatura.',
          });
        }
        return;
      }

      if (json.mode === 'subscribed') {
        // Cobranca off-session (cartao ja salvo) deu certo — ja esta ativo.
        setNotice({ type: 'success', text: 'Assinatura ativada! Atualizando...' });
        setTimeout(() => window.location.reload(), 1200);
        return;
      }

      if (json.mode === 'checkout' && json.url) {
        // Stripe Checkout NAO roda dentro do iframe do GHL — abre em nova aba.
        window.open(json.url, '_blank', 'noopener');
        setNotice({
          type: 'success',
          text: 'Abrimos o checkout em uma nova aba. Conclua o pagamento por la.',
        });
        return;
      }

      setNotice({ type: 'error', text: 'Resposta inesperada do checkout.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message ?? 'Erro ao iniciar a assinatura.' });
    } finally {
      setCheckoutSlug(null);
    }
  }

  if (loading) {
    return (
      <div className="mb-8 p-6 rounded-xl border border-border bg-card/40 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-homio-purple-400" />
        <span className="text-sm">Carregando planos...</span>
      </div>
    );
  }

  if (error || !data || data.plans.length === 0) {
    return null; // silencioso — nao bloqueia a home se o billing falhar
  }

  // Auto-decide a visibilidade (gate SOFT, decisao Luan 2026-07-01):
  //   - sem assinatura        => paywall cheio
  //   - assinatura free       => upsell compacto e dispensavel
  //   - assinatura paga        => nao renderiza nada (UsageSummary ja cobre)
  const sub = data.subscription;
  if (sub && sub.is_paid) return null;
  const isUpsell = !!sub && !sub.is_paid;
  if (isUpsell && dismissed) return null;

  return (
    <div className="mb-10 animate-slide-up">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-homio-purple-300 text-xs font-semibold uppercase tracking-wide mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            {isUpsell ? 'Fazer upgrade' : 'Ative seu atendimento com IA'}
          </div>
          <h3 className="text-xl font-bold text-foreground">
            {isUpsell ? 'Precisa de mais mensagens?' : 'Escolha um plano para comecar'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isUpsell
              ? 'Faca upgrade para um plano com mais mensagens e menor custo de excedente.'
              : 'Assine para liberar o atendimento automatico dos seus agentes. Cancele quando quiser.'}
          </p>
        </div>
        {isUpsell && (
          <button
            onClick={() => setDismissed(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            Agora nao
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl mb-4 text-sm font-medium ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {data.plans.map((plan) => {
          const highlight = plan.slug === HIGHLIGHT_SLUG;
          const isCurrent = data.subscription?.plan_slug === plan.slug;
          const busy = checkoutSlug === plan.slug;
          const perks = PERKS[plan.slug] ?? [];
          return (
            <div
              key={plan.slug}
              className={`relative p-5 rounded-2xl border flex flex-col ${
                highlight
                  ? 'border-homio-purple-500/50 bg-homio-purple-500/5 shadow-lg shadow-homio-purple-500/10'
                  : 'border-border bg-card/40'
              }`}
            >
              {highlight && (
                <div className="absolute -top-2.5 left-5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-homio-purple-600 to-homio-purple-500 text-white text-[10px] font-bold uppercase tracking-wide">
                  Mais popular
                </div>
              )}

              <div className="mb-3">
                <div className="text-sm font-semibold text-foreground">{plan.name}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground tabular-nums">
                    {formatBrl(plan.monthly_price_brl)}
                  </span>
                  <span className="text-xs text-muted-foreground">/mes</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {plan.monthly_message_limit.toLocaleString('pt-BR')} mensagens incluidas
                </div>
              </div>

              <ul className="space-y-1.5 mb-5 flex-1">
                {perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-homio-purple-400 mt-0.5 shrink-0" />
                    {perk}
                  </li>
                ))}
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Zap className="w-3.5 h-3.5 text-homio-purple-400 mt-0.5 shrink-0" />
                  Excedente {formatBrl(plan.overage_price_per_msg_brl)}/msg
                </li>
              </ul>

              <button
                onClick={() => subscribe(plan.slug)}
                disabled={busy || isCurrent}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed ${
                  highlight
                    ? 'bg-gradient-to-r from-homio-purple-600 to-homio-purple-500 text-white hover:from-homio-purple-500 hover:to-homio-purple-400 shadow-lg shadow-homio-purple-500/20'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {isCurrent ? 'Plano atual' : busy ? 'Processando...' : 'Assinar'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
