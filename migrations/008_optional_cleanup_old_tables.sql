-- Migration: Optional Cleanup of Old Tables
-- Date: 2025-01-XX
-- Description: Optional migration to remove old tables after migrating to knowledge_items
-- WARNING: This will DELETE all data in chunks, documents, and faqs tables
-- Only run this after confirming all data has been migrated to knowledge_items

-- Uncomment the sections below when ready to clean up old tables

-- Drop foreign key constraints first
-- ALTER TABLE chunks DROP CONSTRAINT IF EXISTS chunks_document_id_fkey;
-- ALTER TABLE chunks DROP CONSTRAINT IF EXISTS chunks_agent_id_fkey;
-- ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_source_id_fkey;
-- ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_agent_id_fkey;
-- ALTER TABLE faqs DROP CONSTRAINT IF EXISTS faqs_knowledge_base_id_fkey;
-- ALTER TABLE faqs DROP CONSTRAINT IF EXISTS faqs_agent_id_fkey;

-- Drop indexes
-- DROP INDEX IF EXISTS idx_chunks_document_id;
-- DROP INDEX IF EXISTS idx_chunks_agent_id;
-- DROP INDEX IF EXISTS idx_documents_source_id;
-- DROP INDEX IF EXISTS idx_documents_agent_id;
-- DROP INDEX IF EXISTS idx_faqs_knowledge_base_id;
-- DROP INDEX IF EXISTS idx_faqs_agent_id;

-- Drop tables (in reverse dependency order)
-- DROP TABLE IF EXISTS chunks CASCADE;
-- DROP TABLE IF EXISTS documents CASCADE;
-- DROP TABLE IF EXISTS faqs CASCADE;

-- Note: kb_sources and crawl_jobs are kept as they're still needed for:
-- - Managing crawl sources
-- - Tracking crawl jobs
-- - Linking to knowledge_bases


