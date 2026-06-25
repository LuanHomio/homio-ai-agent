// Helpers de billing compartilhados entre o checkout (B2) e o webhook (B3).
//
// A fonte da verdade da assinatura ativa de cada location e a tabela
// `location_subscription` (1 linha por location — unique em location_id). O
// checkout grava otimisticamente quando a cobranca off-session da certo na hora;
// o webhook do Stripe reescreve de forma idempotente conforme os eventos chegam.

import { supabase } from '@/lib/supabase';
import type { PlanWithStripeIds } from '@/lib/stripe';

export const PUBLIC_PLAN_SLUGS = ['basico', 'intermediario', 'avancado'] as const;
export type PublicPlanSlug = (typeof PUBLIC_PLAN_SLUGS)[number];

export function isPublicPlanSlug(slug: unknown): slug is PublicPlanSlug {
  return typeof slug === 'string' && (PUBLIC_PLAN_SLUGS as readonly string[]).includes(slug);
}

// Cap de overage por plano (regra de negocio = 20% do base). Hoje NAO vive no
// billing_plans, entao fica como constante; fonte: pricing definido na wiki
// (Basico R$40 / Intermediario R$100 / Avancado R$200). O enforcement do cap e
// do PR C — aqui so persistimos o valor pra location_subscription ja nascer com ele.
export const OVERAGE_CAP_BRL_BY_SLUG: Record<PublicPlanSlug, number> = {
  basico: 40,
  intermediario: 100,
  avancado: 200,
};

export interface BillingPlanRow extends PlanWithStripeIds {
  id: string;
  slug: string;
  name: string;
  monthly_price_brl: number;
  monthly_message_limit: number;
  overage_price_per_msg_brl: number;
  is_public: boolean;
  is_active: boolean;
}

// Carrega um plano publico+ativo pelo slug. Retorna null se nao existir ou nao
// estiver disponivel pra contratacao (so os 3 publicos viram produto no Stripe).
export async function loadPublicPlanBySlug(slug: string): Promise<BillingPlanRow | null> {
  const { data, error } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error('[billing] loadPublicPlanBySlug:', error.message);
    return null;
  }
  return data as unknown as BillingPlanRow;
}

export interface ActiveSubscriptionRow {
  status: string;
  plan_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
}

// Le a assinatura atual da location (qualquer status). Usada pelo checkout pra
// nao recriar uma sub paga que ja existe.
export async function getLocationSubscription(
  locationUuid: string,
): Promise<ActiveSubscriptionRow | null> {
  const { data, error } = await supabase
    .from('location_subscription')
    .select('status, plan_id, stripe_subscription_id, stripe_customer_id')
    .eq('location_id', locationUuid)
    .maybeSingle();
  if (error || !data) return null;
  return data as ActiveSubscriptionRow;
}

export interface UpsertSubscriptionParams {
  locationUuid: string;
  planId: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** Item de overage (metered) da subscription — guardado pra debug/report do meter. */
  stripeSubscriptionItemId: string | null;
  overageCapBrl: number | null;
  currentPeriodStart: string; // ISO
  currentPeriodEnd: string; // ISO
}

// Upsert idempotente da assinatura (unique em location_id → 1 sub por location).
// Reusado por B2 (sucesso off-session) e B3 (eventos do Stripe).
export async function upsertLocationSubscription(p: UpsertSubscriptionParams) {
  const { error } = await supabase.from('location_subscription').upsert(
    {
      location_id: p.locationUuid,
      plan_id: p.planId,
      status: p.status,
      stripe_customer_id: p.stripeCustomerId,
      stripe_subscription_id: p.stripeSubscriptionId,
      stripe_subscription_item_id: p.stripeSubscriptionItemId,
      overage_cap_brl: p.overageCapBrl,
      current_period_start: p.currentPeriodStart,
      current_period_end: p.currentPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'location_id' },
  );
  if (error) {
    console.error('[billing] upsertLocationSubscription:', error.message);
    throw new Error(`upsert location_subscription falhou: ${error.message}`);
  }
}
