import { createClient } from '@supabase/supabase-js';

// Resolucao location GHL -> Stripe customer existente da Homio.
//
// A base de clientes da Homio ja tem cartao cadastrado no MESMO Stripe (cobranca
// SaaS via GHL). O link location->customer vive no Supabase financeiro ("Portal
// HPN"), exposto por UM unico RPC restrito: `get_stripe_customer_by_location`.
//
// Usamos a publishable/anon key da finance de proposito: ela so consegue chamar
// esse RPC (RLS bloqueia as tabelas accounts/clients/subscriptions direto).
// NUNCA usar a service key da finance aqui — daria acesso total ao banco financeiro.
//
// Instanciacao LAZY: `createClient` lanca ("supabaseUrl is required") se a env
// estiver ausente. Instanciar no import quebrava o `next build` no passo
// "Collecting page data" (as envs FINANCE_* nao existem em Preview). So instancia
// no primeiro uso em runtime.
function buildFinanceClient() {
  const financeUrl = process.env.FINANCE_SUPABASE_URL;
  const financeAnonKey = process.env.FINANCE_SUPABASE_ANON_KEY;
  if (!financeUrl || !financeAnonKey) {
    throw new Error('FINANCE_SUPABASE_URL/FINANCE_SUPABASE_ANON_KEY ausentes');
  }
  return createClient(financeUrl, financeAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let _financeClient: ReturnType<typeof buildFinanceClient> | null = null;

function getFinanceClient() {
  if (!_financeClient) _financeClient = buildFinanceClient();
  return _financeClient;
}

export interface FinanceCustomer {
  stripeCustomerId: string;
  clientActive: boolean;
  subscriptionStatus: string | null;
}

interface RpcRow {
  stripe_customer_id: string | null;
  client_active: boolean | null;
  subscription_status: string | null;
}

// Retorna o Stripe customer da location (cartao ja salvo), ou null quando a
// location nao tem cliente mapeado/sem stripe_id na finance — nesse caso o
// checkout cai no fluxo de cliente novo (cartao digitado uma vez).
export async function resolveStripeCustomerByLocation(
  ghlLocationId: string,
): Promise<FinanceCustomer | null> {
  const { data, error } = await getFinanceClient().rpc(
    'get_stripe_customer_by_location',
    { p_location: ghlLocationId },
  );

  if (error) {
    console.error(
      '[finance] get_stripe_customer_by_location falhou:',
      error.message,
    );
    return null;
  }

  const row: RpcRow | undefined = Array.isArray(data) ? data[0] : data;
  if (!row?.stripe_customer_id) return null;

  return {
    stripeCustomerId: row.stripe_customer_id,
    clientActive: !!row.client_active,
    subscriptionStatus: row.subscription_status ?? null,
  };
}
