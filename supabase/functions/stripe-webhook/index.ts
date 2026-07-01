// EF stripe-webhook (B3 do billing) — persiste a fonte da verdade da assinatura
// (`location_subscription`) conforme os eventos do Stripe chegam.
//
// Fecha o lado do Checkout: o checkout (B2) so grava location_subscription no
// sucesso off-session; quando cai pro Stripe Checkout, a sub so existe apos o
// pagamento e e ESTE webhook que persiste.
//
// - Verifica a assinatura do Stripe (async/SubtleCrypto, exigido no Deno).
// - Idempotente: dedup por event.id em stripe_webhook_events + upserts por
//   location_id (1 sub por location) que sao naturalmente idempotentes.
// - Deploy publico (verify_jwt=false) — a autenticidade vem da assinatura Stripe.
//
// Secrets necessarias na EF: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import Stripe from "https://esm.sh/stripe@22.3.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Cap de overage por plano (espelha src/lib/billing.ts — regra de negocio que
// hoje nao vive no billing_plans). 20% do base: R$40/100/200.
const OVERAGE_CAP_BRL_BY_SLUG: Record<string, number> = {
  basico: 40,
  intermediario: 100,
  avancado: 200,
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
  appInfo: { name: "homio-ai-agent" },
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function makeSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}
type Supabase = ReturnType<typeof makeSupabase>;

// O Stripe usa um vocabulario de status proprio (e 'canceled' com 1 L); a coluna
// location_subscription.status tem um CHECK que so aceita active/past_due/
// cancelled(2 L)/paused/trialing. Traduz pra esse conjunto pra nunca violar o
// constraint (e nunca marcar 'active' por engano).
function normalizeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "paused":
      return "paused";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return "past_due"; // fallback seguro
  }
}

function isoFromUnix(sec: number | null | undefined, fallback: Date): string {
  if (typeof sec === "number" && sec > 0) return new Date(sec * 1000).toISOString();
  return fallback.toISOString();
}

function subscriptionPeriod(sub: Stripe.Subscription): { start: string; end: string } {
  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 86400000);
  const item = sub.items?.data?.[0] as unknown as Record<string, number> | undefined;
  const subAny = sub as unknown as Record<string, number>;
  return {
    start: isoFromUnix(subAny.current_period_start ?? item?.current_period_start, now),
    end: isoFromUnix(subAny.current_period_end ?? item?.current_period_end, in30d),
  };
}

// Persiste/atualiza a location_subscription a partir de uma Subscription do Stripe.
// A location e o plano vem do metadata gravado no checkout (B2). Sem isso, nao da
// pra mapear — loga e ignora (nao e uma sub nossa, ou veio sem metadata).
async function upsertFromSubscription(supabase: Supabase, sub: Stripe.Subscription) {
  const locationUuid = sub.metadata?.location_uuid;
  const planId = sub.metadata?.plan_id;
  const planSlug = sub.metadata?.plan_slug;
  if (!locationUuid || !planId) {
    console.warn("[stripe-webhook] sub sem metadata location/plan, ignorando:", sub.id);
    return;
  }

  const overageItem = sub.items.data.find(
    (i) => i.price?.recurring?.usage_type === "metered",
  );
  const cap = planSlug && planSlug in OVERAGE_CAP_BRL_BY_SLUG
    ? OVERAGE_CAP_BRL_BY_SLUG[planSlug]
    : null;
  const { start, end } = subscriptionPeriod(sub);

  const { error } = await supabase.from("location_subscription").upsert(
    {
      location_id: locationUuid,
      plan_id: planId,
      status: normalizeStatus(sub.status),
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
      stripe_subscription_id: sub.id,
      stripe_subscription_item_id: overageItem?.id ?? null,
      overage_cap_brl: cap,
      current_period_start: start,
      current_period_end: end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "location_id" },
  );
  if (error) throw new Error(`upsert location_subscription: ${error.message}`);
  console.log("[stripe-webhook] sub upsert:", sub.id, "->", locationUuid, sub.status);
}

// Marca a sub por stripe_subscription_id (deleted -> cancelled, payment_failed ->
// past_due). Nao apaga a linha: mantem historico; o enforcement (PR C) decide o
// degrade. updated por subscription id (nao location) pra nao depender de metadata.
async function setStatusBySubscriptionId(
  supabase: Supabase,
  subscriptionId: string,
  status: string,
) {
  if (!subscriptionId) return;
  const { error } = await supabase
    .from("location_subscription")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId);
  if (error) throw new Error(`update status: ${error.message}`);
  console.log("[stripe-webhook] status set:", subscriptionId, "->", status);
}

async function handleEvent(supabase: Supabase, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
      if (!subId) {
        console.warn("[stripe-webhook] checkout sem subscription:", session.id);
        return;
      }
      const sub = await stripe.subscriptions.retrieve(subId);
      // Caso o Checkout nao tenha propagado o metadata pra sub, herda do session.
      if (!sub.metadata?.location_uuid && session.metadata?.location_uuid) {
        sub.metadata = { ...sub.metadata, ...session.metadata };
      }
      await upsertFromSubscription(supabase, sub);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertFromSubscription(supabase, event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await setStatusBySubscriptionId(supabase, (event.data.object as Stripe.Subscription).id, "cancelled");
      break;
    case "invoice.payment_failed": {
      // Na API v22 o `subscription` saiu do topo da Invoice; mora em
      // parent.subscription_details.subscription. Probe os dois formatos.
      const inv = event.data.object as unknown as {
        subscription?: string | { id?: string };
        parent?: { subscription_details?: { subscription?: string | { id?: string } } };
      };
      const raw = inv.subscription ?? inv.parent?.subscription_details?.subscription;
      const subId = typeof raw === "string" ? raw : raw?.id;
      if (subId) await setStatusBySubscriptionId(supabase, subId, "past_due");
      break;
    }
    default:
      console.log("[stripe-webhook] evento ignorado:", event.type);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const sig = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!sig || !secret) {
    return json({ ok: false, error: "missing_signature_or_secret" }, 400);
  }

  // Body cru e obrigatorio pra verificacao da assinatura.
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret, undefined, cryptoProvider);
  } catch (e) {
    console.error("[stripe-webhook] assinatura invalida:", (e as Error).message);
    return json({ ok: false, error: "invalid_signature" }, 400);
  }

  const supabase = makeSupabase();
  try {
    // Dedup: se ja processamos esse event.id, devolve ok sem reprocessar.
    const { data: seen } = await supabase
      .from("stripe_webhook_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();
    if (seen) return json({ ok: true, dedup: true });

    await handleEvent(supabase, event);

    // Marca como processado so apos sucesso (falha -> 500 -> Stripe retenta).
    const { error: insErr } = await supabase
      .from("stripe_webhook_events")
      .insert({ event_id: event.id, type: event.type });
    if (insErr && insErr.code !== "23505") {
      console.warn("[stripe-webhook] falha registrando dedup:", insErr.message);
    }

    return json({ ok: true, type: event.type });
  } catch (e) {
    console.error("[stripe-webhook] erro processando", event.type, ":", (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
