-- Permitir agent_id ser null na tabela kb_sources
-- O agent_id será buscado automaticamente através da knowledge_base_id

ALTER TABLE kb_sources 
ALTER COLUMN agent_id DROP NOT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN kb_sources.agent_id IS 'ID do agent vinculado. Pode ser null se a knowledge_base não estiver vinculada a nenhum agent específico.';
