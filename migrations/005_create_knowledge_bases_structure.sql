-- Create knowledge_bases table linked to locations
CREATE TABLE knowledge_bases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'general', -- general, faq, documents, etc.
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agent_knowledge_bases junction table
CREATE TABLE agent_knowledge_bases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id, knowledge_base_id)
);

-- Add indexes for better performance
CREATE INDEX idx_knowledge_bases_location_id ON knowledge_bases(location_id);
CREATE INDEX idx_knowledge_bases_type ON knowledge_bases(type);
CREATE INDEX idx_agent_knowledge_bases_agent_id ON agent_knowledge_bases(agent_id);
CREATE INDEX idx_agent_knowledge_bases_kb_id ON agent_knowledge_bases(knowledge_base_id);

-- Insert some default knowledge bases for the existing location
INSERT INTO knowledge_bases (location_id, name, description, type) VALUES
(
  (SELECT id FROM locations WHERE ghl_location_id = 'd8voPwkhJK7k7S5xjHcA'),
  'Base de Conhecimento Geral',
  'Base de conhecimento geral da empresa com informações sobre produtos e serviços',
  'general'
),
(
  (SELECT id FROM locations WHERE ghl_location_id = 'd8voPwkhJK7k7S5xjHcA'),
  'FAQ - Perguntas Frequentes',
  'Perguntas e respostas mais comuns dos clientes',
  'faq'
),
(
  (SELECT id FROM locations WHERE ghl_location_id = 'd8voPwkhJK7k7S5xjHcA'),
  'Documentos Técnicos',
  'Documentação técnica e manuais de produtos',
  'documents'
);

-- Link existing agent to all knowledge bases
INSERT INTO agent_knowledge_bases (agent_id, knowledge_base_id)
SELECT 
  a.id as agent_id,
  kb.id as knowledge_base_id
FROM agents a
CROSS JOIN knowledge_bases kb
WHERE a.location_id = (SELECT id FROM locations WHERE ghl_location_id = 'd8voPwkhJK7k7S5xjHcA');
