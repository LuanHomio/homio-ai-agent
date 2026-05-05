-- Migration: Create agent_actions table
-- Date: 2026-05-05
-- Description: Tabela que armazena as actions configuradas de cada agent.
-- Espelha o schema da API Conversation AI nativa do GHL (7 tipos de action)
-- pra manter paridade de nomenclatura — facilita port futuro bidirecional
-- e o builder dinamico no inbound-webhook (config -> Gemini function_declaration).
--
-- Schema canonico do GHL documentado em wiki/processos/processo_ghl_actions.md.

CREATE TABLE IF NOT EXISTS agent_actions (
    id           uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id     uuid          NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

    -- Os 7 tipos canonicos do GHL Conversation AI.
    action_type  varchar(50)   NOT NULL CHECK (action_type IN (
                                  'triggerWorkflow',
                                  'updateContactField',
                                  'appointmentBooking',
                                  'stopBot',
                                  'humanHandOver',
                                  'advancedFollowup',
                                  'transferBot'
                              )),

    -- Nome legivel da action. Limite 3-50 chars pra paridade com GHL.
    name         text          NOT NULL CHECK (char_length(name) BETWEEN 3 AND 50),

    -- Descricao livre. Vai virar o `description` da function_declaration do Gemini
    -- (e o que o LLM usa pra decidir quando chamar a action).
    description  text,

    -- Espelha o `details` do GHL. Usa os MESMOS nomes de campo da API GHL
    -- (workflowIds, contactFieldId, contactUpdateExamples, stopBotExamples,
    -- triggerCondition, calendarId, scenarioId, followupSequence,
    -- handoverType, examples, assignToUserId, tags, etc).
    -- Validacao do shape por tipo fica na camada da API Next.js (Zod).
    config       jsonb         NOT NULL DEFAULT '{}'::jsonb,

    -- Liga/desliga sem deletar. Usado pelo builder dinamico no inbound-webhook.
    is_active    boolean       NOT NULL DEFAULT true,

    -- Ordem de prioridade quando o LLM tem multiplas actions plausiveis.
    -- Usado pra reorder na UI (drag-and-drop futuro).
    sort_order   integer       NOT NULL DEFAULT 0,

    created_at   timestamptz   NOT NULL DEFAULT now(),
    updated_at   timestamptz   NOT NULL DEFAULT now()
);

-- FK lookup: listar todas actions de um agent (UI + builder).
CREATE INDEX IF NOT EXISTS idx_agent_actions_agent_id
    ON agent_actions(agent_id);

-- Hot path do builder dinamico no inbound-webhook:
-- "actions ativas desse agent na ordem de prioridade".
CREATE INDEX IF NOT EXISTS idx_agent_actions_active_sort
    ON agent_actions(agent_id, sort_order)
    WHERE is_active = true;

-- Trigger updated_at (reusa funcao generica ja existente no schema).
DROP TRIGGER IF EXISTS trg_agent_actions_updated_at ON agent_actions;
CREATE TRIGGER trg_agent_actions_updated_at
    BEFORE UPDATE ON agent_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS: mesmo padrao do resto do schema — Next.js API acessa via service_role.
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage agent_actions"
    ON agent_actions
    FOR ALL
    USING (auth.role() = 'service_role');

-- Documentacao no banco (aparece em pgAdmin / Supabase Studio).
COMMENT ON TABLE  agent_actions             IS 'Actions configuraveis por agent (paridade com GHL Conversation AI). Cada linha vira 1 function_declaration no Gemini function calling do inbound-webhook.';
COMMENT ON COLUMN agent_actions.action_type IS 'Um dos 7 tipos canonicos do GHL: triggerWorkflow, updateContactField, appointmentBooking, stopBot, humanHandOver, advancedFollowup, transferBot.';
COMMENT ON COLUMN agent_actions.config      IS 'JSON espelhando o `details` do GHL (mesmos nomes de campo). Schema por tipo validado na API Next.js.';
COMMENT ON COLUMN agent_actions.is_active   IS 'False = action desligada (nao entra no tools[] do Gemini). Usar pra pausar sem deletar.';
COMMENT ON COLUMN agent_actions.sort_order  IS 'Prioridade quando o LLM tem multiplas actions plausiveis. Reorder via UI.';
