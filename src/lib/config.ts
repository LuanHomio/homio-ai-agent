// Environment configuration
export const config = {
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE!,
  },
  firecrawl: {
    apiKey: process.env.FIRECRAWL_API_KEY!,
  },
  n8n: {
    webhookUrl: process.env.N8N_CRAWL_WEBHOOK,
  },
  dify: {
    apiBase: process.env.DIFY_API_BASE!,
    apiKey: process.env.DIFY_API_KEY!,
    externalKbApiKey: process.env.EXTERNAL_KB_API_KEY!,
  },
} as const;

// Validation function
export function validateConfig() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE',
    'FIRECRAWL_API_KEY',
    'DIFY_API_BASE',
    'DIFY_API_KEY',
    'EXTERNAL_KB_API_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return true;
}
