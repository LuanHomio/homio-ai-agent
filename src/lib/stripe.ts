import Stripe from 'stripe';

// Client Stripe server-side. A chave define o modo (test/live) automaticamente:
// uma sk_test_ opera no sandbox (cobrancas simuladas), sk_live_ cobra de verdade.
const secretKey = process.env.STRIPE_SECRET_KEY!;

export const stripe = new Stripe(secretKey, {
  appInfo: { name: 'homio-ai-agent' },
});

// Modo derivado da chave. billing_plans guarda os IDs de test em colunas com
// sufixo `_test` e os de live nas colunas sem sufixo — `planStripeIds` escolhe
// o conjunto certo conforme este modo. No go-live so trocar a STRIPE_SECRET_KEY.
export const stripeMode: 'test' | 'live' = secretKey?.startsWith('sk_test')
  ? 'test'
  : 'live';

// Event name do Billing Meter compartilhado pelos 3 planos (mesmo nome em test e
// live). O runtime reporta o excedente via `POST /v1/billing/meter_events` com
// este event_name e `payload.value` = qtd de mensagens excedentes.
export const OVERAGE_METER_EVENT = 'agent_message_overage';

export interface PlanStripeIds {
  productId: string | null;
  basePriceId: string | null;
  overagePriceId: string | null;
}

// Linha de billing_plans com as duas variantes (live + test) dos IDs do Stripe.
export interface PlanWithStripeIds {
  stripe_product_id: string | null;
  stripe_base_price_id: string | null;
  stripe_overage_price_id: string | null;
  stripe_product_id_test: string | null;
  stripe_base_price_id_test: string | null;
  stripe_overage_price_id_test: string | null;
}

// Resolve os IDs do Stripe de um plano conforme o modo atual da chave.
export function planStripeIds(plan: PlanWithStripeIds): PlanStripeIds {
  if (stripeMode === 'test') {
    return {
      productId: plan.stripe_product_id_test,
      basePriceId: plan.stripe_base_price_id_test,
      overagePriceId: plan.stripe_overage_price_id_test,
    };
  }
  return {
    productId: plan.stripe_product_id,
    basePriceId: plan.stripe_base_price_id,
    overagePriceId: plan.stripe_overage_price_id,
  };
}
