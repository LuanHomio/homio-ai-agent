export type Plan = {
  slug: string;
  name: string;
  monthly_price_brl: number;
  monthly_message_limit: number;
  overage_price_per_msg_brl: number;
};

export type Subscription = {
  plan_slug: string;
  plan_name: string;
  status: string;
  is_paid: boolean;
  current_period_end: string | null;
};

export type OverviewResponse = {
  subscription: Subscription | null;
  plans: Plan[];
};

export type Notice = { type: 'success' | 'error'; text: string } | null;

// Destaque visual do plano do meio (mais vendido). Ordem vem do backend por preco.
export const HIGHLIGHT_SLUG = 'intermediario';

export function formatBrl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
