'use client';

import { Check, Loader2, Zap } from 'lucide-react';
import { HIGHLIGHT_SLUG, formatBrl, type Plan } from './types';

// Beneficios curtos por plano (copy de vendas — nao vem do banco).
const PERKS: Record<string, string[]> = {
  basico: ['Ideal pra começar', 'Todos os canais da Homio', 'Base de conhecimento'],
  intermediario: ['Melhor custo por mensagem', 'Documentos, imagens e áudio', 'Suporte prioritário'],
  avancado: ['Alto volume', 'Menor preço de excedente', 'Múltiplos agentes'],
};

export function PlansGrid({
  plans,
  currentSlug,
  checkoutSlug,
  onSubscribe,
}: {
  plans: Plan[];
  currentSlug?: string | null;
  checkoutSlug: string | null;
  onSubscribe: (slug: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((plan) => {
        const highlight = plan.slug === HIGHLIGHT_SLUG;
        const isCurrent = currentSlug === plan.slug;
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
                <span className="text-xs text-muted-foreground">/mês</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {plan.monthly_message_limit.toLocaleString('pt-BR')} mensagens incluídas
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
              onClick={() => onSubscribe(plan.slug)}
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
  );
}

export function NoticeBanner({ notice }: { notice: { type: 'success' | 'error'; text: string } }) {
  return (
    <div
      className={`p-3 rounded-xl mb-4 text-sm font-medium ${
        notice.type === 'success'
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : 'bg-red-500/10 text-red-400 border border-red-500/20'
      }`}
    >
      {notice.text}
    </div>
  );
}
