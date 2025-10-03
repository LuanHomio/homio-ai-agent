#!/usr/bin/env node

/**
 * Setup script for Knowledge Base MVP
 * This script helps configure the environment and validate setup
 */

const fs = require('fs');
const path = require('path');

const ENV_TEMPLATE = `# Supabase Configuration
SUPABASE_URL=https://wjuigblcflvwmybmrldq.supabase.co
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqdWlnYmxjZmx2d215Ym1ybGRxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ5NjcwNSwiZXhwIjoyMDc1MDcyNzA1fQ.HW7IL-gY2RuS6ul3fL1Il_zEP_LWl98cEccQYVz3T6A

# Firecrawl API
FIRECRAWL_API_KEY=fc-51b7b93aa1f74b088edef3bcf9bfad72

# n8n Webhook (optional)
N8N_CRAWL_WEBHOOK=https://your-n8n-instance.com/webhook/crawl

# Dify Configuration
DIFY_API_BASE=https://api.dify.ai/v1
DIFY_API_KEY=app-1kX2DUoMmd9oW7thZ4s6krFe
EXTERNAL_KB_API_KEY=dataset-uTwLJE3386A6hoLNKFip7qlf;

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE',
  'FIRECRAWL_API_KEY',
  'DIFY_API_BASE',
  'DIFY_API_KEY',
  'EXTERNAL_KB_API_KEY'
];

function createEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  
  if (fs.existsSync(envPath)) {
    console.log('✅ .env.local already exists');
    return;
  }

  try {
    fs.writeFileSync(envPath, ENV_TEMPLATE);
    console.log('✅ Created .env.local file');
    console.log('📝 Please update the environment variables in .env.local');
  } catch (error) {
    console.error('❌ Failed to create .env.local:', error.message);
  }
}

function validateEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env.local file not found');
    return false;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const missing = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    const regex = new RegExp(`^${envVar}=(.+)$`, 'm');
    const match = envContent.match(regex);
    
    if (!match || match[1].includes('your_') || match[1].trim() === '') {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.log('❌ Missing or incomplete environment variables:');
    missing.forEach(envVar => console.log(`   - ${envVar}`));
    return false;
  }

  console.log('✅ All required environment variables are configured');
  return true;
}

function checkDependencies() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log('❌ package.json not found');
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const requiredDeps = [
    'next',
    '@supabase/supabase-js',
    '@firecrawl/js',
    'react',
    'react-dom'
  ];

  const missing = requiredDeps.filter(dep => 
    !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
  );

  if (missing.length > 0) {
    console.log('❌ Missing dependencies:');
    missing.forEach(dep => console.log(`   - ${dep}`));
    console.log('📦 Run: npm install');
    return false;
  }

  console.log('✅ All dependencies are installed');
  return true;
}

function createDirectories() {
  const dirs = [
    'src/components/ui',
    'src/lib',
    'src/hooks',
    'src/app/api/kb',
    'src/app/api/kb/jobs',
    'src/app/api/kb/faqs',
    'src/app/api/dify',
    'src/app/api/webhooks/n8n',
    'docs'
  ];

  dirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });
}

function showNextSteps() {
  console.log('\n🚀 Next Steps:');
  console.log('1. Update environment variables in .env.local');
  console.log('2. Run: npm install');
  console.log('3. Run: npm run dev');
  console.log('4. Open: http://localhost:3000');
  console.log('\n📚 Documentation:');
  console.log('- README.md - Main documentation');
  console.log('- docs/n8n-setup.md - n8n configuration');
  console.log('- docs/dify-integration.md - Dify integration');
}

function main() {
  console.log('🔧 Knowledge Base MVP Setup\n');

  // Create directories
  createDirectories();

  // Create .env.local
  createEnvFile();

  // Check dependencies
  const depsOk = checkDependencies();

  // Validate environment
  const envOk = validateEnvFile();

  if (depsOk && envOk) {
    console.log('\n✅ Setup completed successfully!');
    showNextSteps();
  } else {
    console.log('\n❌ Setup incomplete. Please fix the issues above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
