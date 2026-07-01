import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireLocation } from '@/lib/authz';
import { PUBLIC_PLAN_SLUGS } from '@/lib/billing';

export const dynamic = 'force-dynamic';

// GET /api/billing/overview — dados pro paywall/gate da home.
//
// Retorna a assinatura atual da location (ou null) + o catalogo dos 3 planos
// publicos. A location vem SEMPRE da sessao assinada (nunca de query/body).
//
// Semantica do gate (decisao Luan 2026-07-01): `subscription` != null com status
// ativo (inclui o plano free) => tem acesso, sem paywall. `subscription` null =>
// sem assinatura nenhuma => a home mostra a LP de planos. Gate SOFT: a UI decide
// mostrar banner sem bloquear o app.

interface PlanOut {
  slug: string;
  name: string;
  monthly_price_brl: number;
  monthly_message_limit: number;
  overage_price_per_msg_brl: number;
}

interface SubscriptionOut {
  plan_slug: string;
  plan_name: string;
  status: string;
  is_paid: boolean;
  current_period_end: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireLocation(request);
    if (auth instanceof NextResponse) return auth;

    // Assinatura atual da location (1 linha por location). Join com o plano pra
    // pegar slug/nome legiveis.
    const { data: subRow, error: subErr } = await supabase
      .from('location_subscription')
      .select('status, current_period_end, billing_plans!inner(slug, name)')
      .eq('location_id', auth.locationUuid)
      .maybeSingle();
    if (subErr) {
      console.error('[billing/overview] subscription:', subErr.message);
      return NextResponse.json({ error: 'failed_to_load_subscription' }, { status: 500 });
    }

    let subscription: SubscriptionOut | null = null;
    if (subRow) {
      const plan = (subRow as any).billing_plans as { slug: string; name: string };
      subscription = {
        plan_slug: plan.slug,
        plan_name: plan.name,
        status: (subRow as any).status,
        is_paid: (PUBLIC_PLAN_SLUGS as readonly string[]).includes(plan.slug),
        current_period_end: (subRow as any).current_period_end ?? null,
      };
    }

    // Catalogo dos 3 planos publicos, ordenado por preco.
    const { data: planRows, error: plansErr } = await supabase
      .from('billing_plans')
      .select('slug, name, monthly_price_brl, monthly_message_limit, overage_price_per_msg_brl')
      .eq('is_public', true)
      .eq('is_active', true)
      .order('monthly_price_brl', { ascending: true });
    if (plansErr) {
      console.error('[billing/overview] plans:', plansErr.message);
      return NextResponse.json({ error: 'failed_to_load_plans' }, { status: 500 });
    }

    const plans: PlanOut[] = (planRows ?? [])
      .filter((p: any) => (PUBLIC_PLAN_SLUGS as readonly string[]).includes(p.slug))
      .map((p: any) => ({
        slug: p.slug,
        name: p.name,
        monthly_price_brl: Number(p.monthly_price_brl) || 0,
        monthly_message_limit: Number(p.monthly_message_limit) || 0,
        overage_price_per_msg_brl: Number(p.overage_price_per_msg_brl) || 0,
      }));

    return NextResponse.json({ subscription, plans });
  } catch (err: any) {
    console.error('[billing/overview]', err);
    return NextResponse.json({ error: 'internal_error', detail: err?.message }, { status: 500 });
  }
}
