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
  gemini: {
    apiKey: process.env.GEMINI_API_KEY!,
  },
  ghl: {
    clientId: process.env.GHL_CLIENT_ID!,
    clientSecret: process.env.GHL_CLIENT_SECRET!,
    companyId: process.env.GHL_COMPANY_ID!,
    redirectUri: process.env.GHL_AUTH_REDIRECT_URI!,
    apiVersion: process.env.GHL_API_VERSION || '2021-07-28',
    appAccessToken: process.env.GHL_APP_ACCESS_TOKEN,
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
    'GEMINI_API_KEY',
    'GHL_CLIENT_ID',
    'GHL_CLIENT_SECRET',
    'GHL_COMPANY_ID',
    'GHL_AUTH_REDIRECT_URI',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return true;
}
