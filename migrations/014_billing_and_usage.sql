-- Migration 014: Fundacao de billing/usage (sem Stripe ainda, integracao vem no PR B).
-- Schema cobre catalogo de planos, assinatura por location, captura diaria de uso por agent,
-- view consolidada do periodo corrente e RPC atomico de incremento.

-- =============================================================
-- 1) Catalogo de planos
-- =============================================================
CREATE TABLE IF NOT EXISTS billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  monthly_price_brl NUMERIC(10,2) NOT NULL,
  monthly_message_limit INT NOT NULL,
  overage_price_per_msg_brl NUMERIC(10,4) NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Stripe IDs preenchidos quando o PR B integrar com Stripe.
  stripe_product_id TEXT,
  stripe_base_price_id TEXT,
  stripe_overage_price_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_plans_public_active ON billing_plans(is_public, is_active);

COMMENT ON TABLE billing_plans IS 'Catalogo de tiers de cobranca do Homio AI Agent.';
COMMENT ON COLUMN billing_plans.is_public IS 'false = plano interno (free interno, corporativo sob consulta), nao aparece em listagens publicas.';

-- =============================================================
-- 2) Assinatura por location
-- =============================================================
CREATE TABLE IF NOT EXISTS location_subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES billing_plans(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  overage_cap_brl NUMERIC(10,2),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  -- Stripe (PR B)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_subscription_item_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(location_id),
  CONSTRAINT location_subscription_status_check
    CHECK (status IN ('active', 'past_due', 'cancelled', 'paused', 'trialing'))
);

CREATE INDEX IF NOT EXISTS idx_location_subscription_status ON location_subscription(status) WHERE status <> 'active';
CREATE INDEX IF NOT EXISTS idx_location_subscription_period_end ON location_subscription(current_period_end);

COMMENT ON COLUMN location_subscription.overage_cap_brl IS 'Limite de overage que o cliente autoriza por periodo. NULL = sem cap (todo overage e cobrado). 0 = nao autoriza overage (ao estourar, degrada).';
COMMENT ON COLUMN location_subscription.current_period_start IS 'Inicio do periodo de cobranca atual. Rolling 30 dias a partir da data de assinatura.';

-- =============================================================
-- 3) Captura diaria de uso por agent
-- =============================================================
CREATE TABLE IF NOT EXISTS agent_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  message_count INT NOT NULL DEFAULT 0,
  prompt_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  estimated_cost_brl NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, date)
);

CREATE INDEX IF NOT EXISTS idx_agent_usage_location_date ON agent_usage_daily(location_id, date);
CREATE INDEX IF NOT EXISTS idx_agent_usage_date ON agent_usage_daily(date);

COMMENT ON TABLE agent_usage_daily IS 'Agregado diario de mensagens processadas pelo inbound-webhook por agent. Granularidade diaria pra alimentar dashboard.';

-- =============================================================
-- 4) RPC atomica de incremento (chamada pelo inbound-webhook)
-- =============================================================
CREATE OR REPLACE FUNCTION increment_agent_usage(
  p_agent_id UUID,
  p_location_id UUID,
  p_date DATE,
  p_messages INT,
  p_prompt_tokens BIGINT,
  p_output_tokens BIGINT,
  p_cost_brl NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO agent_usage_daily (
    agent_id, location_id, date,
    message_count, prompt_tokens, output_tokens, estimated_cost_brl
  )
  VALUES (
    p_agent_id, p_location_id, p_date,
    p_messages, p_prompt_tokens, p_output_tokens, p_cost_brl
  )
  ON CONFLICT (agent_id, date) DO UPDATE SET
    message_count = agent_usage_daily.message_count + EXCLUDED.message_count,
    prompt_tokens = agent_usage_daily.prompt_tokens + EXCLUDED.prompt_tokens,
    output_tokens = agent_usage_daily.output_tokens + EXCLUDED.output_tokens,
    estimated_cost_brl = agent_usage_daily.estimated_cost_brl + EXCLUDED.estimated_cost_brl,
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION increment_agent_usage IS 'Incrementa atomicamente o uso diario de um agent. Chamado pelo inbound-webhook ao final de cada batch.';

-- =============================================================
-- 5) View consolidada do periodo corrente por location
-- =============================================================
CREATE OR REPLACE VIEW location_usage_current_period AS
SELECT
  ls.location_id,
  ls.plan_id,
  bp.slug AS plan_slug,
  bp.name AS plan_name,
  bp.monthly_message_limit AS plan_limit,
  bp.overage_price_per_msg_brl AS overage_price,
  bp.monthly_price_brl AS plan_price,
  ls.overage_cap_brl,
  ls.current_period_start,
  ls.current_period_end,
  ls.status,
  COALESCE(SUM(aud.message_count), 0)::INT AS messages_used,
  GREATEST(COALESCE(SUM(aud.message_count), 0) - bp.monthly_message_limit, 0)::INT AS overage_messages,
  (GREATEST(COALESCE(SUM(aud.message_count), 0) - bp.monthly_message_limit, 0) * bp.overage_price_per_msg_brl)::NUMERIC(10,2) AS overage_charge_brl,
  COALESCE(SUM(aud.prompt_tokens), 0)::BIGINT AS prompt_tokens_total,
  COALESCE(SUM(aud.output_tokens), 0)::BIGINT AS output_tokens_total,
  COALESCE(SUM(aud.estimated_cost_brl), 0)::NUMERIC(10,4) AS our_cost_brl
FROM location_subscription ls
JOIN billing_plans bp ON bp.id = ls.plan_id
LEFT JOIN agent_usage_daily aud
  ON aud.location_id = ls.location_id
  AND aud.date >= ls.current_period_start::DATE
  AND aud.date <= ls.current_period_end::DATE
GROUP BY ls.location_id, ls.plan_id, bp.slug, bp.name, bp.monthly_message_limit,
         bp.overage_price_per_msg_brl, bp.monthly_price_brl, ls.overage_cap_brl,
         ls.current_period_start, ls.current_period_end, ls.status;

COMMENT ON VIEW location_usage_current_period IS 'Consolidado do periodo corrente de cada location: plano, limite, uso, overage estimado.';

-- =============================================================
-- 6) Seed dos planos iniciais
-- =============================================================
INSERT INTO billing_plans (slug, name, monthly_price_brl, monthly_message_limit, overage_price_per_msg_brl, is_public)
VALUES
  ('free',          'Free Interno',  0,    100,    0,    false),
  ('basico',        'Basico',        197,  1000,   0.40, true),
  ('intermediario', 'Intermediario', 497,  4000,   0.30, true),
  ('avancado',      'Avancado',      997,  20000,  0.20, true),
  ('corporativo',   'Corporativo',   0,    50000,  0,    false)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================
-- 7) Assinatura free pras locations existentes (Internal Testing etc)
-- =============================================================
-- Inserir uma assinatura no plano "free" pra cada location que ainda nao tem assinatura.
-- Periodo inicial 30 dias a partir de agora. Sem cap (free nao gera overage por design).
INSERT INTO location_subscription (location_id, plan_id, overage_cap_brl, current_period_start, current_period_end)
SELECT l.id, bp.id, 0, NOW(), NOW() + INTERVAL '30 days'
FROM locations l
CROSS JOIN billing_plans bp
WHERE bp.slug = 'free'
  AND NOT EXISTS (SELECT 1 FROM location_subscription ls WHERE ls.location_id = l.id);
