'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Calendar, Loader2, TrendingUp, Zap } from 'lucide-react';

type Subscription = {
  plan_slug: string;
  plan_name: string;
  plan_price_brl: number;
  plan_limit: number;
  overage_price: number;
  overage_cap_brl: number | null;
  status: string;
  current_period_start: string;
  current_period_end: string;
};

type CurrentPeriod = {
  messages_used: number;
  overage_messages: number;
  overage_charge_brl: number;
  pct_used: number;
  days_elapsed: number;
  days_remaining: number;
  total_days: number;
  projected_messages: number;
  our_cost_brl: number;
};

type AgentUsage = {
  agent_id: string;
  name: string;
  message_count: number;
  estimated_cost_brl: number;
};

type DailyPoint = {
  date: string;
  message_count: number;
};

type UsageResponse = {
  subscription: Subscription;
  current_period: CurrentPeriod;
  by_agent: AgentUsage[];
  daily: DailyPoint[];
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
}

function formatBrl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function UsageSummary({ locationId }: { locationId: string }) {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchUsage() {
      if (!locationId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/locations/${locationId}/usage`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Sem assinatura ativa pra essa location.');
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Falha ao carregar uso.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchUsage();
    return () => { cancelled = true; };
  }, [locationId]);

  const dailyChartMax = useMemo(() => {
    if (!data?.daily?.length) return 1;
    return Math.max(...data.daily.map((d) => d.message_count), 1);
  }, [data]);

  if (loading) {
    return (
      <div className="mb-8 p-6 rounded-xl border border-border bg-card/40 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-homio-purple-400" />
        <span className="text-sm">Carregando uso do mês...</span>
      </div>
    );
  }

  if (error || !data) {
    return null; // silencioso por enquanto — sem assinatura nao bloqueia a pagina
  }

  const { subscription: sub, current_period: cp, by_agent, daily } = data;
  const overBudget = cp.pct_used >= 100;
  const nearLimit = cp.pct_used >= 80 && !overBudget;
  const projectedOver = cp.projected_messages > sub.plan_limit;

  return (
    <div className="mb-8 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Uso do mês</h3>
          <p className="text-xs text-muted-foreground">
            Plano <span className="text-foreground font-medium">{sub.plan_name}</span>
            {sub.plan_price_brl > 0 && <> · {formatBrl(sub.plan_price_brl)}/mês</>}
            {' · '}período {formatDate(sub.current_period_start)} → {formatDate(sub.current_period_end)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className={`p-4 rounded-xl border ${overBudget ? 'border-red-500/40 bg-red-500/5' : nearLimit ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card/40'}`}>
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1">
            <Activity className="w-3.5 h-3.5" /> Mensagens
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {cp.messages_used.toLocaleString('pt-BR')}
            <span className="text-sm text-muted-foreground font-normal"> / {sub.plan_limit.toLocaleString('pt-BR')}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full ${overBudget ? 'bg-red-400' : nearLimit ? 'bg-amber-400' : 'bg-homio-purple-500'}`}
              style={{ width: `${Math.min(100, cp.pct_used)}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">{cp.pct_used}% utilizado</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/40">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1">
            <Calendar className="w-3.5 h-3.5" /> Dias restantes
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {cp.days_remaining}
            <span className="text-sm text-muted-foreground font-normal"> / {cp.total_days}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Reseta em {formatDate(sub.current_period_end)}
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${projectedOver ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card/40'}`}>
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1">
            <TrendingUp className="w-3.5 h-3.5" /> Projeção do mês
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {cp.projected_messages.toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {projectedOver ? (
              <span className="text-amber-300 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Ritmo acima do limite
              </span>
            ) : (
              'No ritmo do plano'
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/40">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1">
            <Zap className="w-3.5 h-3.5" /> Overage estimado
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {formatBrl(cp.overage_charge_brl)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {cp.overage_messages > 0
              ? `${cp.overage_messages} msgs × ${formatBrl(sub.overage_price)}`
              : 'Dentro do plano'}
          </div>
        </div>
      </div>

      {/* Mini-grafico de barras diarias */}
      {daily.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card/40 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase text-muted-foreground">Mensagens por dia</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              pico {dailyChartMax} msg
            </div>
          </div>
          <div className="relative h-24 flex items-end gap-[2px]">
            {daily.map((d) => {
              const heightPx = d.message_count > 0
                ? Math.max(2, Math.round((d.message_count / dailyChartMax) * 96))
                : 1;
              const hasData = d.message_count > 0;
              return (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col items-stretch justify-end"
                  title={`${formatDate(d.date)}: ${d.message_count} mensagem${d.message_count === 1 ? '' : 's'}`}
                >
                  <div
                    className={`w-full rounded-t transition-all ${
                      hasData
                        ? 'bg-gradient-to-t from-homio-purple-600/60 to-homio-purple-400'
                        : 'bg-secondary'
                    }`}
                    style={{ height: `${heightPx}px` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>{formatDate(daily[0].date)}</span>
            {daily.length > 14 && (
              <span>{formatDate(daily[Math.floor(daily.length / 2)].date)}</span>
            )}
            <span>{formatDate(daily[daily.length - 1].date)}</span>
          </div>
        </div>
      )}

      {/* Breakdown por agent */}
      {by_agent.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card/40">
          <div className="text-xs uppercase text-muted-foreground mb-3">Uso por agente</div>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left font-medium py-1">Agente</th>
                <th className="text-right font-medium py-1">Mensagens</th>
                <th className="text-right font-medium py-1">% do total</th>
                <th className="text-right font-medium py-1">Custo estimado</th>
              </tr>
            </thead>
            <tbody>
              {by_agent.map((a) => {
                const pct = cp.messages_used > 0 ? Math.round((a.message_count / cp.messages_used) * 100) : 0;
                return (
                  <tr key={a.agent_id} className="border-t border-border/50">
                    <td className="py-2 text-foreground">{a.name}</td>
                    <td className="py-2 text-right tabular-nums">{a.message_count.toLocaleString('pt-BR')}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{pct}%</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{formatBrl(a.estimated_cost_brl)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
