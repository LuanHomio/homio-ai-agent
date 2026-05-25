import { NextRequest, NextResponse } from 'next/server';
import { supabase, pageAll } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type LocationParam = { id: string }; // ghl_location_id (string) ou UUID interno

// Resolve o location UUID. Aceita ambos os formatos pra ser robusto contra o iframe SSO.
async function resolveLocationUuid(idParam: string): Promise<string | null> {
  // UUID v4 regex simples
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam)) {
    return idParam;
  }
  const { data, error } = await supabase
    .from('locations')
    .select('id')
    .eq('ghl_location_id', idParam)
    .maybeSingle();
  if (error || !data) return null;
  return data.id;
}

export async function GET(_request: NextRequest, { params }: { params: LocationParam }) {
  try {
    const locationUuid = await resolveLocationUuid(params.id);
    if (!locationUuid) return NextResponse.json({ error: 'location_not_found' }, { status: 404 });

    const { data: usage, error: usageErr } = await supabase
      .from('location_usage_current_period')
      .select('*')
      .eq('location_id', locationUuid)
      .maybeSingle();
    if (usageErr) {
      console.error('[usage] view error:', usageErr);
      return NextResponse.json({ error: 'failed_to_load_usage' }, { status: 500 });
    }
    if (!usage) {
      return NextResponse.json({ error: 'no_subscription' }, { status: 404 });
    }

    const periodStart = new Date(usage.current_period_start);
    const periodEnd = new Date(usage.current_period_end);
    const now = new Date();
    const totalDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000));
    const elapsedDays = Math.max(1, Math.round((now.getTime() - periodStart.getTime()) / 86400000));
    const daysRemaining = Math.max(0, Math.round((periodEnd.getTime() - now.getTime()) / 86400000));

    const messagesUsed = Number(usage.messages_used) || 0;
    const planLimit = Number(usage.plan_limit) || 0;
    const pctUsed = planLimit > 0 ? Math.min(100, Math.round((messagesUsed / planLimit) * 100)) : 0;
    const projectedMessages = elapsedDays > 0 ? Math.round((messagesUsed / elapsedDays) * totalDays) : 0;

    // Serie diaria (todos os dias do periodo atual com agregado de mensagens)
    const periodStartIso = periodStart.toISOString().slice(0, 10);
    const periodEndIso = periodEnd.toISOString().slice(0, 10);
    // pageAll: location com N agents × 30 dias passa de 1000 com N>33 (tier Corporativo).
    const dailyRows = await pageAll<any>((from, to) =>
      supabase
        .from('agent_usage_daily')
        .select('date, message_count, prompt_tokens, output_tokens, estimated_cost_brl')
        .eq('location_id', locationUuid)
        .gte('date', periodStartIso)
        .lte('date', periodEndIso)
        .order('date', { ascending: true })
        .range(from, to)
    );

    // Agregar por dia (varios agents podem somar)
    const dailyMap = new Map<string, { date: string; message_count: number; prompt_tokens: number; output_tokens: number; estimated_cost_brl: number }>();
    for (const row of dailyRows as any[]) {
      const key = String(row.date);
      const prev = dailyMap.get(key) ?? { date: key, message_count: 0, prompt_tokens: 0, output_tokens: 0, estimated_cost_brl: 0 };
      dailyMap.set(key, {
        date: key,
        message_count: prev.message_count + (Number(row.message_count) || 0),
        prompt_tokens: prev.prompt_tokens + (Number(row.prompt_tokens) || 0),
        output_tokens: prev.output_tokens + (Number(row.output_tokens) || 0),
        estimated_cost_brl: prev.estimated_cost_brl + (Number(row.estimated_cost_brl) || 0),
      });
    }
    // Preenche TODOS os dias do periodo (mesmo sem uso) pra ficar com cara de grafico.
    const daily: Array<{ date: string; message_count: number; prompt_tokens: number; output_tokens: number; estimated_cost_brl: number }> = [];
    const cursor = new Date(periodStart);
    cursor.setUTCHours(0, 0, 0, 0);
    const endCursor = new Date(periodEnd);
    endCursor.setUTCHours(0, 0, 0, 0);
    while (cursor <= endCursor) {
      const key = cursor.toISOString().slice(0, 10);
      daily.push(dailyMap.get(key) ?? { date: key, message_count: 0, prompt_tokens: 0, output_tokens: 0, estimated_cost_brl: 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // Breakdown por agent (mesmo periodo)
    const byAgentRows = await pageAll<any>((from, to) =>
      supabase
        .from('agent_usage_daily')
        .select('agent_id, message_count, prompt_tokens, output_tokens, estimated_cost_brl')
        .eq('location_id', locationUuid)
        .gte('date', periodStartIso)
        .lte('date', periodEndIso)
        .range(from, to)
    );

    const byAgentMap = new Map<string, { agent_id: string; message_count: number; prompt_tokens: number; output_tokens: number; estimated_cost_brl: number }>();
    for (const row of byAgentRows as any[]) {
      const key = String(row.agent_id);
      const prev = byAgentMap.get(key) ?? { agent_id: key, message_count: 0, prompt_tokens: 0, output_tokens: 0, estimated_cost_brl: 0 };
      byAgentMap.set(key, {
        agent_id: key,
        message_count: prev.message_count + (Number(row.message_count) || 0),
        prompt_tokens: prev.prompt_tokens + (Number(row.prompt_tokens) || 0),
        output_tokens: prev.output_tokens + (Number(row.output_tokens) || 0),
        estimated_cost_brl: prev.estimated_cost_brl + (Number(row.estimated_cost_brl) || 0),
      });
    }

    // Resolve nomes dos agents
    const agentIds = Array.from(byAgentMap.keys());
    let agentNames: Record<string, string> = {};
    if (agentIds.length > 0) {
      const { data: agentRows } = await supabase
        .from('agents')
        .select('id, name')
        .in('id', agentIds);
      for (const a of (agentRows ?? []) as any[]) {
        agentNames[a.id] = a.name;
      }
    }
    const byAgent = Array.from(byAgentMap.values())
      .map((a) => ({ ...a, name: agentNames[a.agent_id] ?? '(agent removido)' }))
      .sort((a, b) => b.message_count - a.message_count);

    return NextResponse.json({
      subscription: {
        plan_slug: usage.plan_slug,
        plan_name: usage.plan_name,
        plan_price_brl: Number(usage.plan_price) || 0,
        plan_limit: planLimit,
        overage_price: Number(usage.overage_price) || 0,
        overage_cap_brl: usage.overage_cap_brl == null ? null : Number(usage.overage_cap_brl),
        status: usage.status,
        current_period_start: usage.current_period_start,
        current_period_end: usage.current_period_end,
      },
      current_period: {
        messages_used: messagesUsed,
        overage_messages: Number(usage.overage_messages) || 0,
        overage_charge_brl: Number(usage.overage_charge_brl) || 0,
        pct_used: pctUsed,
        days_elapsed: elapsedDays,
        days_remaining: daysRemaining,
        total_days: totalDays,
        projected_messages: projectedMessages,
        prompt_tokens_total: Number(usage.prompt_tokens_total) || 0,
        output_tokens_total: Number(usage.output_tokens_total) || 0,
        our_cost_brl: Number(usage.our_cost_brl) || 0,
      },
      by_agent: byAgent,
      daily,
    });
  } catch (err: any) {
    console.error('[locations/usage]', err);
    return NextResponse.json({ error: 'internal_error', detail: err?.message }, { status: 500 });
  }
}
