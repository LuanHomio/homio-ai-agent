-- Migration: Add Locations and Agents tables
-- Date: 2024-01-XX
-- Description: Create hierarchical structure for multi-agent management

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create locations table (sub-accounts)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(100) UNIQUE NOT NULL, -- URL-friendly identifier
    ghl_location_id VARCHAR(100), -- Future GoHighLevel integration
    settings JSONB DEFAULT '{}', -- Location-specific settings
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    personality TEXT, -- Agent personality/behavior description
    system_prompt TEXT, -- Custom system prompt for the agent
    dify_app_id VARCHAR(255), -- Dify app ID for this agent
    settings JSONB DEFAULT '{}', -- Agent-specific settings
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique agent names within a location
    UNIQUE(location_id, name)
);

-- Update existing tables to reference agents instead of being global

-- Add agent_id to kb_sources
ALTER TABLE kb_sources ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;

-- Add agent_id to faqs
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;

-- Add agent_id to crawl_jobs (inherited from source)
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;

-- Add agent_id to documents (inherited from source)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;

-- Add agent_id to chunks (inherited from document)
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_locations_slug ON locations(slug);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);
CREATE INDEX IF NOT EXISTS idx_agents_location_id ON agents(location_id);
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(is_active);
CREATE INDEX IF NOT EXISTS idx_kb_sources_agent_id ON kb_sources(agent_id);
CREATE INDEX IF NOT EXISTS idx_faqs_agent_id ON faqs(agent_id);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_agent_id ON crawl_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_documents_agent_id ON documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_chunks_agent_id ON chunks(agent_id);

-- Enable RLS on new tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for locations (service role only for now)
CREATE POLICY "Service role can manage locations" ON locations
    FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for agents (service role only for now)
CREATE POLICY "Service role can manage agents" ON agents
    FOR ALL USING (auth.role() = 'service_role');

-- Update existing RLS policies to include agent_id checks
-- Note: This will be handled in the application layer for now

-- Insert default location for existing data
INSERT INTO locations (name, description, slug, ghl_location_id)
VALUES (
    'Default Location',
    'Default location for existing data',
    'default',
    NULL
) ON CONFLICT (slug) DO NOTHING;

-- Get the default location ID
DO $$
DECLARE
    default_location_id UUID;
BEGIN
    SELECT id INTO default_location_id FROM locations WHERE slug = 'default' LIMIT 1;
    
    -- Create default agent for existing data
    INSERT INTO agents (location_id, name, description, personality, system_prompt)
    VALUES (
        default_location_id,
        'Default Agent',
        'Default agent for existing data',
        'Helpful and professional assistant',
        'You are a helpful assistant specialized in consignment services for INSS portability and FGTS.'
    ) ON CONFLICT (location_id, name) DO NOTHING;
END $$;

-- Update existing records to reference the default agent
DO $$
DECLARE
    default_agent_id UUID;
BEGIN
    SELECT a.id INTO default_agent_id 
    FROM agents a 
    JOIN locations l ON a.location_id = l.id 
    WHERE l.slug = 'default' AND a.name = 'Default Agent' 
    LIMIT 1;
    
    -- Update existing kb_sources
    UPDATE kb_sources SET agent_id = default_agent_id WHERE agent_id IS NULL;
    
    -- Update existing faqs
    UPDATE faqs SET agent_id = default_agent_id WHERE agent_id IS NULL;
    
    -- Update existing crawl_jobs (via source relationship)
    UPDATE crawl_jobs 
    SET agent_id = ks.agent_id 
    FROM kb_sources ks 
    WHERE crawl_jobs.source_id = ks.id AND crawl_jobs.agent_id IS NULL;
    
    -- Update existing documents (via source relationship)
    UPDATE documents 
    SET agent_id = ks.agent_id 
    FROM kb_sources ks 
    WHERE documents.source_id = ks.id AND documents.agent_id IS NULL;
    
    -- Update existing chunks (via document relationship)
    UPDATE chunks 
    SET agent_id = d.agent_id 
    FROM documents d 
    WHERE chunks.document_id = d.id AND chunks.agent_id IS NULL;
END $$;

-- Add NOT NULL constraints after updating existing data
ALTER TABLE kb_sources ALTER COLUMN agent_id SET NOT NULL;
ALTER TABLE faqs ALTER COLUMN agent_id SET NOT NULL;
ALTER TABLE crawl_jobs ALTER COLUMN agent_id SET NOT NULL;
ALTER TABLE documents ALTER COLUMN agent_id SET NOT NULL;
ALTER TABLE chunks ALTER COLUMN agent_id SET NOT NULL;
