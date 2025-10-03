#!/usr/bin/env node

/**
 * Create .env.local file with the credentials from setup.js
 */

const fs = require('fs');
const path = require('path');

const ENV_CONTENT = `# Supabase Configuration
SUPABASE_URL=https://wjuigblcflvwmybmrldq.supabase.co
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqdWlnYmxjZmx2d215Ym1ybGRxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ5NjcwNSwiZXhwIjoyMDc1MDcyNzA1fQ.HW7IL-gY2RuS6ul3fL1Il_zEP_LWl98cEccQYVz3T6A

# Firecrawl API
FIRECRAWL_API_KEY=fc-51b7b93aa1f74b088edef3bcf9bfad72

# n8n Webhook (optional)
N8N_CRAWL_WEBHOOK=https://your-n8n-instance.com/webhook/crawl

# Dify Configuration
DIFY_API_BASE=https://api.dify.ai/v1
DIFY_API_KEY=app-1kX2DUoMmd9oW7thZ4s6krFe
EXTERNAL_KB_API_KEY=dataset-uTwLJE3386A6hoLNKFip7qlf`;

function createEnvLocal() {
  const envLocalPath = path.join(process.cwd(), '.env.local');
  
  try {
    fs.writeFileSync(envLocalPath, ENV_CONTENT);
    console.log('✅ Created .env.local file with your credentials');
    console.log('📝 All environment variables are now configured');
  } catch (error) {
    console.log('❌ Failed to create .env.local:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  createEnvLocal();
}

module.exports = { createEnvLocal };
