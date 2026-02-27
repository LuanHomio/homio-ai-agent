-- Migration: Create Unified Knowledge Items Table
-- Date: 2025-01-XX
-- Description: Create unified knowledge_items table for RAG with vector search support
-- This replaces the need to query chunks and faqs separately

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create unified knowledge_items table
CREATE TABLE knowledge_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  
  -- Content information
  content_type VARCHAR(50) NOT NULL, -- 'chunk', 'faq', 'document'
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 dimension, adjust if using different model
  
  -- Metadata (JSONB for flexibility)
  metadata JSONB DEFAULT '{}',
  
  -- Source references (for traceability)
  source_entity_id UUID, -- ID of original entity (chunk.id, faq.id, document.id)
  source_entity_type VARCHAR(50), -- 'chunk', 'faq', 'document'
  
  -- Common metadata fields (denormalized for quick access)
  title TEXT,
  url TEXT,
  token_count INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_content_type CHECK (content_type IN ('chunk', 'faq', 'document')),
  CONSTRAINT valid_source_type CHECK (source_entity_type IS NULL OR source_entity_type IN ('chunk', 'faq', 'document'))
);

-- Create indexes for performance
CREATE INDEX idx_knowledge_items_kb_id ON knowledge_items(knowledge_base_id);
CREATE INDEX idx_knowledge_items_content_type ON knowledge_items(content_type);
CREATE INDEX idx_knowledge_items_source_entity ON knowledge_items(source_entity_type, source_entity_id);
CREATE INDEX idx_knowledge_items_created_at ON knowledge_items(created_at DESC);

-- GIN index for JSONB metadata queries
CREATE INDEX idx_knowledge_items_metadata ON knowledge_items USING GIN (metadata);

-- Vector similarity index (IVFFlat for approximate nearest neighbor search)
-- Note: IVFFlat index can be created on empty table, but performance is better
-- after data is inserted. Consider rebuilding index after initial data load:
-- DROP INDEX idx_knowledge_items_embedding;
-- CREATE INDEX idx_knowledge_items_embedding ON knowledge_items 
-- USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- 
-- For small datasets (< 1000 rows), HNSW might be better:
-- CREATE INDEX idx_knowledge_items_embedding ON knowledge_items 
-- USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_knowledge_items_embedding ON knowledge_items 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION search_knowledge_items(
  query_embedding vector(1536),
  kb_ids UUID[] DEFAULT NULL,
  content_types VARCHAR[] DEFAULT NULL,
  top_k INTEGER DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
  knowledge_base_id UUID,
  content_type VARCHAR,
  content TEXT,
  title TEXT,
  url TEXT,
  metadata JSONB,
  similarity FLOAT,
  token_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ki.id,
    ki.knowledge_base_id,
    ki.content_type,
    ki.content,
    ki.title,
    ki.url,
    ki.metadata,
    1 - (ki.embedding <=> query_embedding)::FLOAT as similarity,
    ki.token_count,
    ki.created_at
  FROM knowledge_items ki
  WHERE
    ki.embedding IS NOT NULL
    AND (kb_ids IS NULL OR ki.knowledge_base_id = ANY(kb_ids))
    AND (content_types IS NULL OR ki.content_type = ANY(content_types))
    AND (1 - (ki.embedding <=> query_embedding)::FLOAT) >= similarity_threshold
  ORDER BY ki.embedding <=> query_embedding
  LIMIT top_k;
END;
$$;

-- Create function for text search (fallback when embeddings are not available)
CREATE OR REPLACE FUNCTION search_knowledge_items_text(
  query_text TEXT,
  kb_ids UUID[] DEFAULT NULL,
  content_types VARCHAR[] DEFAULT NULL,
  top_k INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  knowledge_base_id UUID,
  content_type VARCHAR,
  content TEXT,
  title TEXT,
  url TEXT,
  metadata JSONB,
  token_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ki.id,
    ki.knowledge_base_id,
    ki.content_type,
    ki.content,
    ki.title,
    ki.url,
    ki.metadata,
    ki.token_count,
    ki.created_at
  FROM knowledge_items ki
  WHERE
    (kb_ids IS NULL OR ki.knowledge_base_id = ANY(kb_ids))
    AND (content_types IS NULL OR ki.content_type = ANY(content_types))
    AND (
      ki.content ILIKE '%' || query_text || '%'
      OR ki.title ILIKE '%' || query_text || '%'
      OR (ki.metadata::TEXT ILIKE '%' || query_text || '%')
    )
  ORDER BY ki.created_at DESC
  LIMIT top_k;
END;
$$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_knowledge_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_knowledge_items_updated_at
  BEFORE UPDATE ON knowledge_items
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_items_updated_at();

-- Enable RLS
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all knowledge items
CREATE POLICY "Service role can manage knowledge items" ON knowledge_items
  FOR ALL USING (auth.role() = 'service_role');

-- Add comment to table
COMMENT ON TABLE knowledge_items IS 'Unified table for all knowledge base content (chunks, FAQs, documents) with vector embeddings for semantic search';
COMMENT ON COLUMN knowledge_items.embedding IS 'Vector embedding for semantic similarity search. Dimension: 1536 (OpenAI ada-002). Adjust if using different model.';
COMMENT ON COLUMN knowledge_items.content_type IS 'Type of content: chunk, faq, or document';
COMMENT ON COLUMN knowledge_items.source_entity_id IS 'Reference to original entity ID for traceability';
COMMENT ON COLUMN knowledge_items.source_entity_type IS 'Type of source entity (chunk, faq, document)';

