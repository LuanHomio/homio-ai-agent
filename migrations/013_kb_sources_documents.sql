-- Migration 013: estende kb_sources para aceitar documentos uploadados (PDF/DOCX/CSV)
-- Mantem compat retroativa: rows existentes (URLs do crawler) viram source_type='url', status='completed'.

ALTER TABLE kb_sources
  ALTER COLUMN url DROP NOT NULL;

ALTER TABLE kb_sources
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) NOT NULL DEFAULT 'url',
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE kb_sources
  DROP CONSTRAINT IF EXISTS kb_sources_source_type_check;
ALTER TABLE kb_sources
  ADD CONSTRAINT kb_sources_source_type_check CHECK (source_type IN ('url', 'document'));

ALTER TABLE kb_sources
  DROP CONSTRAINT IF EXISTS kb_sources_status_check;
ALTER TABLE kb_sources
  ADD CONSTRAINT kb_sources_status_check CHECK (status IN ('pending', 'processing', 'completed', 'error'));

CREATE INDEX IF NOT EXISTS idx_kb_sources_source_type ON kb_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_kb_sources_status ON kb_sources(status) WHERE status <> 'completed';
CREATE INDEX IF NOT EXISTS idx_kb_sources_metadata ON kb_sources USING GIN (metadata);

COMMENT ON COLUMN kb_sources.source_type IS 'Tipo da fonte: url (crawler) ou document (upload PDF/DOCX/CSV)';
COMMENT ON COLUMN kb_sources.status IS 'pending: criada, aguardando worker. processing: extracao em andamento. completed: chunks em knowledge_items. error: falhou (ver metadata.error_message)';
COMMENT ON COLUMN kb_sources.metadata IS 'filename, mime, size_bytes, storage_path, page_count, chunk_count, error_message, etc.';

-- Storage bucket privado para documentos. RLS: service_role escreve/le; leitura cliente via signed URL gerada server-side.
INSERT INTO storage.buckets (id, name, public)
VALUES ('kb-documents', 'kb-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: somente service_role tem acesso direto. Reads do cliente sempre via signed URL.
DROP POLICY IF EXISTS "kb_documents_service_role_all" ON storage.objects;
CREATE POLICY "kb_documents_service_role_all"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'kb-documents')
  WITH CHECK (bucket_id = 'kb-documents');
