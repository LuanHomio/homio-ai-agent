export type CrawlScope = 'domain' | 'path' | 'single';
export type JobStatus = 'pending' | 'running' | 'success' | 'error';

export interface KBSource {
  id: string;
  url: string;
  scope: CrawlScope;
  depth: number;
  knowledge_base_id: string;
  agent_id?: string; // Manter para compatibilidade
  is_active: boolean;
  created_at: string;
  created_by?: string;
}

export interface CrawlJob {
  id: string;
  source_id: string;
  agent_id: string;
  status: JobStatus;
  started_at?: string;
  finished_at?: string;
  error?: string;
  meta: Record<string, any>;
  created_at: string;
}

export interface Document {
  id: string;
  source_id: string;
  agent_id: string;
  url: string;
  title?: string;
  content: string;
  hash: string;
  created_at: string;
}

export interface Chunk {
  id: string;
  document_id: string;
  agent_id: string;
  position: number;
  content: string;
  token_count?: number;
  created_at: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  knowledge_base_id: string;
  agent_id?: string; // Manter para compatibilidade
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  name: string;
  description?: string;
  slug: string;
  ghl_location_id?: string;
  settings: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  location_id: string;
  name: string;
  description?: string;
  personality?: string;
  objective?: string;
  additional_info?: string;
  system_prompt?: string;
  dify_app_id?: string;
  settings: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  location?: Location; // Populated when joining
}

export interface CreateLocationRequest {
  name: string;
  description?: string;
  slug: string;
  ghl_location_id?: string;
  settings?: Record<string, any>;
}

export interface UpdateLocationRequest {
  name?: string;
  description?: string;
  slug?: string;
  ghl_location_id?: string;
  settings?: Record<string, any>;
  is_active?: boolean;
}

export interface CreateAgentRequest {
  location_id: string;
  name: string;
  description?: string;
  personality?: string;
  objective?: string;
  additional_info?: string;
  system_prompt?: string;
  dify_app_id?: string;
  settings?: Record<string, any>;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  personality?: string;
  objective?: string;
  additional_info?: string;
  system_prompt?: string;
  dify_app_id?: string;
  settings?: Record<string, any>;
  is_active?: boolean;
}

export interface CreateSourceRequest {
  url: string;
  scope: CrawlScope;
  depth: number;
  knowledge_base_id: string;
  agent_id?: string; // Manter para compatibilidade
}

export interface CrawlRequest {
  sourceId: string;
  mode: 'direct' | 'n8n';
}

export interface CrawlResponse {
  jobId: string;
}

export interface JobStatusResponse {
  status: JobStatus;
  error?: string;
  meta?: Record<string, any>;
}

export interface DifyRetrievalRequest {
  query: string;
  top_k?: number;
  filters?: Record<string, any>;
}

export interface DifyRetrievalResponse {
  chunks: Array<{
    content: string;
    score: number;
    metadata: Record<string, any>;
  }>;
}

export interface KnowledgeBase {
  id: string;
  location_id: string;
  name: string;
  description?: string;
  type: string;
  settings: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  location?: Location;
}

export interface AgentKnowledgeBase {
  id: string;
  agent_id: string;
  knowledge_base_id: string;
  created_at: string;
  knowledge_base?: KnowledgeBase;
}

export interface CreateKnowledgeBaseRequest {
  location_id: string;
  name: string;
  description?: string;
  type?: string;
  settings?: Record<string, any>;
}

export interface UpdateKnowledgeBaseRequest {
  name?: string;
  description?: string;
  type?: string;
  settings?: Record<string, any>;
  is_active?: boolean;
}

export interface UpdateAgentKnowledgeBasesRequest {
  knowledge_base_ids: string[];
}

export interface InboundJob {
  id: string;
  message_id: string;
  agent_id: string;
  location_id: string;
  contact_id: string;
  conversation_id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  knowledge_base_ids: string[];
  message_text: string;
  response_text?: string;
  context_sources?: Array<{ content: string; source: string }>;
  error_message?: string;
  processing_time_ms?: number;
  created_at: string;
  updated_at: string;
}

export interface InboundMessage {
  id: string;
  message_id: string;
  location_id: string;
  contact_id: string;
  conversation_id: string;
  webhook_id: string;
  agent_id: string;
  body: string;
  content_type: string;
  direction: string;
  message_type: string;
  status: string;
  source: string;
  timestamp: string;
  raw_payload: Record<string, any>;
  created_at: string;
}

