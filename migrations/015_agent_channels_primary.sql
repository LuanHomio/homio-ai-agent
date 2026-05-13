-- Migration 015: configuracoes de canal/primary/modo no agent.
-- Sem auto-ativacao do primary ainda — Luan pediu pra deixar pra depois
-- (ele usa o numero pessoal). is_primary fica disponivel como flag mas
-- nao altera enforcement do inbound-webhook nesta fase.

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enabled_channels JSONB NOT NULL DEFAULT '["whatsapp_homio"]'::jsonb,
  ADD COLUMN IF NOT EXISTS response_mode VARCHAR(20) NOT NULL DEFAULT 'responsive';

-- So 1 agent primario por location (constraint suave: aplicada via index parcial)
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_one_primary_per_location
  ON agents(location_id) WHERE is_primary = true;

ALTER TABLE agents
  DROP CONSTRAINT IF EXISTS agents_response_mode_check;
ALTER TABLE agents
  ADD CONSTRAINT agents_response_mode_check CHECK (response_mode IN ('responsive', 'suggestive'));

COMMENT ON COLUMN agents.is_primary IS 'Marca o agente padrao da location. So 1 por location. Comportamento de auto-ativacao em novas conversas sera implementado em PR futuro.';
COMMENT ON COLUMN agents.enabled_channels IS 'Array de canais que o agent responde: whatsapp_homio, whatsapp_meta, instagram. Inbound em canal nao listado vai pra status=skipped.';
COMMENT ON COLUMN agents.response_mode IS 'responsive: envia resposta direto (default). suggestive: cria sugestao no GHL sem enviar (reservado, ainda nao implementado).';
