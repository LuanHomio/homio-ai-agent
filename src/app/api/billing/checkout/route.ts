import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { requireLocation } from '@/lib/authz';
import { getStripe, planStripeIds } from '@/lib/stripe';
import { resolveStripeCustomerByLocation } from '@/lib/finance-customer';
import {
  isPublicPlanSlug,
  loadPublicPlanBySlug,
  getLocationSubscription,
  upsertLocationSubscription,
  OVERAGE_CAP_BRL_BY_SLUG,
  type PublicPlanSlug,
} from '@/lib/billing';

export const dynamic = 'force-dynamic';

// POST /api/billing/checkout — inicia a assinatura de um plano pago.
//
// Cobranca HIBRIDA (decisao Luan 2026-06-25):
//   1. Se a location ja tem Stripe customer na finance COM cartao salvo, tenta
//      cobrar off-session (zero-clique) criando a subscription direto.
//   2. Se o banco exige 3DS (ou nao ha cartao / nao ha customer mapeado), cai no
//      Stripe Checkout (1-clique, cliente confirma/digita o cartao).
//
// A subscription tem 2 line items: base (licensed, flat mensal) + overage
// (metered, linkado ao Billing Meter `agent_message_overage`).
//
// A location vem SEMPRE da sessao assinada — nunca do body (anti cross-tenant).

interface CheckoutBody {
  plan_slug?: string;
}

function isoFromUnix(sec: number | null | undefined, fallback: Date): string {
  if (typeof sec === 'number' && sec > 0) return new Date(sec * 1000).toISOString();
  return fallback.toISOString();
}

// Periodo de cobranca: dependendo da versao da API o Stripe expoe o periodo no
// topo da subscription ou no item. Tenta os dois antes do fallback.
function subscriptionPeriod(sub: Stripe.Subscription): { start: string; end: string } {
  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 86400000);
  const item = sub.items?.data?.[0] as unknown as Record<string, number> | undefined;
  const subAny = sub as unknown as Record<string, number>;
  const start = subAny.current_period_start ?? item?.current_period_start;
  const end = subAny.current_period_end ?? item?.current_period_end;
  return { start: isoFromUnix(start, now), end: isoFromUnix(end, in30d) };
}

// Erro de cartao que justifica cair pro Checkout (decline, 3DS exigido, etc).
function isCardActionError(err: unknown): boolean {
  const e = err as { type?: string; code?: string };
  return e?.type === 'StripeCardError' || e?.code === 'authentication_required';
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireLocation(request);
    if (auth instanceof NextResponse) return auth;
    const { locationUuid, ghlLocationId } = auth;

    const body: CheckoutBody = await request.json().catch(() => ({}));
    const slug = body.plan_slug;
    if (!isPublicPlanSlug(slug)) {
      return NextResponse.json(
        { error: 'invalid_plan', detail: 'plan_slug deve ser basico, intermediario ou avancado' },
        { status: 400 },
      );
    }

    const plan = await loadPublicPlanBySlug(slug);
    if (!plan) return NextResponse.json({ error: 'plan_not_found' }, { status: 404 });

    const ids = planStripeIds(plan);
    if (!ids.basePriceId || !ids.overagePriceId) {
      console.error('[checkout] plano sem stripe price ids:', slug, ids);
      return NextResponse.json({ error: 'plan_not_configured' }, { status: 500 });
    }

    // Ja tem assinatura PAGA ativa? Mudanca de plano sai do escopo do B2.
    const existing = await getLocationSubscription(locationUuid);
    if (existing?.stripe_subscription_id && existing.status === 'active') {
      return NextResponse.json(
        { error: 'already_subscribed', subscription_id: existing.stripe_subscription_id },
        { status: 409 },
      );
    }

    const overageCapBrl = OVERAGE_CAP_BRL_BY_SLUG[slug as PublicPlanSlug] ?? null;
    const metadata: Record<string, string> = {
      location_uuid: locationUuid,
      ghl_location_id: ghlLocationId,
      plan_slug: slug,
      plan_id: plan.id,
    };

    const stripe = getStripe();

    // Resolve customer existente da Homio (cartao ja salvo no mesmo Stripe).
    const finance = await resolveStripeCustomerByLocation(ghlLocationId);
    const cusId = finance?.stripeCustomerId ?? null;

    // Descobre se ha cartao salvo pra tentar o caminho off-session.
    let defaultPm: string | null = null;
    if (cusId) {
      try {
        const customer = await stripe.customers.retrieve(cusId);
        if (!('deleted' in customer && customer.deleted)) {
          const invDefault = (customer as Stripe.Customer).invoice_settings
            ?.default_payment_method;
          defaultPm = typeof invDefault === 'string' ? invDefault : invDefault?.id ?? null;
        }
        if (!defaultPm) {
          const pms = await stripe.paymentMethods.list({ customer: cusId, type: 'card', limit: 1 });
          defaultPm = pms.data[0]?.id ?? null;
        }
      } catch (e) {
        console.warn('[checkout] falha lendo customer/pms, caindo pro Checkout:', e);
      }
    }

    const lineItems = [{ price: ids.basePriceId }, { price: ids.overagePriceId }];

    // --- Caminho 1: off-session (zero-clique) no cartao salvo ---------------
    if (cusId && defaultPm) {
      try {
        const sub = await stripe.subscriptions.create({
          customer: cusId,
          items: lineItems,
          default_payment_method: defaultPm,
          off_session: true,
          payment_behavior: 'error_if_incomplete',
          expand: ['latest_invoice.payment_intent'],
          metadata,
        });

        const overageItem = sub.items.data.find((i) => i.price?.id === ids.overagePriceId);
        const { start, end } = subscriptionPeriod(sub);
        await upsertLocationSubscription({
          locationUuid,
          planId: plan.id,
          status: sub.status, // normalmente 'active'
          stripeCustomerId: cusId,
          stripeSubscriptionId: sub.id,
          stripeSubscriptionItemId: overageItem?.id ?? null,
          overageCapBrl,
          currentPeriodStart: start,
          currentPeriodEnd: end,
        });

        return NextResponse.json({
          mode: 'subscribed',
          subscription_id: sub.id,
          status: sub.status,
          plan_slug: slug,
        });
      } catch (e) {
        if (!isCardActionError(e)) {
          console.error('[checkout] erro inesperado no off-session:', e);
          return NextResponse.json({ error: 'subscription_failed' }, { status: 502 });
        }
        // Banco pediu 3DS ou cartao recusado → segue pro Checkout abaixo.
        console.info('[checkout] off-session exigiu acao, caindo pro Checkout:', (e as Error).message);
      }
    }

    // --- Caminho 2: Stripe Checkout (1-clique / cliente confirma) -----------
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: cusId ?? undefined, // reusa o customer pra aparecer o cartao salvo
      line_items: [
        { price: ids.basePriceId, quantity: 1 },
        { price: ids.overagePriceId }, // metered: sem quantity
      ],
      // Volta pra home (dashboard da location), nao pra /agents/[id] (edicao de
      // agent). O Checkout roda em aba nova top-level, entao a home carrega
      // standalone lendo ?locationId=. O banner billing=success/cancel e tratado la.
      success_url: `${appUrl}/?locationId=${ghlLocationId}&billing=success`,
      cancel_url: `${appUrl}/?locationId=${ghlLocationId}&billing=cancel`,
      subscription_data: { metadata },
      metadata,
    });

    // NAO grava location_subscription aqui — a sub so existe apos o pagamento.
    // O webhook (B3) persiste em checkout.session.completed / subscription.created.
    return NextResponse.json({ mode: 'checkout', url: session.url });
  } catch (err) {
    console.error('[billing/checkout]', err);
    return NextResponse.json(
      { error: 'internal_error', detail: (err as Error)?.message },
      { status: 500 },
    );
  }
}
