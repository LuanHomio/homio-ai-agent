export type CrawlScope = 'domain' | 'path' | 'single';
export type JobStatus = 'pending' | 'running' | 'success' | 'error';

export interface KBSource {
  id: string;
  url: string;
  scope: CrawlScope;
  depth: number;
  is_active: boolean;
  created_at: string;
  created_by?: string;
}

export interface CrawlJob {
  id: string;
  source_id: string;
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
  url: string;
  title?: string;
  content: string;
  hash: string;
  created_at: string;
}

export interface Chunk {
  id: string;
  document_id: string;
  position: number;
  content: string;
  token_count?: number;
  created_at: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSourceRequest {
  url: string;
  scope: CrawlScope;
  depth: number;
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

