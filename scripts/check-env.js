#!/usr/bin/env node

/**
 * Simple environment variables checker
 * Checks if all required environment variables are properly configured
 */

const fs = require('fs');
const path = require('path');

// Try to load .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  console.log('❌ .env.local file not found');
  console.log('📝 Please copy env.example to .env.local and configure your variables');
  process.exit(1);
}

const REQUIRED_VARS = {
  SUPABASE_URL: {
    description: 'Supabase Project URL',
    example: 'https://your-project.supabase.co',
    validate: (value) => value.startsWith('https://') && value.includes('supabase.co')
  },
  SUPABASE_SERVICE_ROLE: {
    description: 'Supabase Service Role Key',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    validate: (value) => value.length > 50 && value.startsWith('eyJ')
  },
  FIRECRAWL_API_KEY: {
    description: 'Firecrawl API Key',
    example: 'fc-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    validate: (value) => value.startsWith('fc-') && value.length > 20
  },
  DIFY_API_BASE: {
    description: 'Dify API Base URL',
    example: 'https://api.dify.ai/v1',
    validate: (value) => value.startsWith('https://') && value.includes('/v1')
  },
  DIFY_API_KEY: {
    description: 'Dify API Key',
    example: 'app-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    validate: (value) => value.length > 20
  },
  EXTERNAL_KB_API_KEY: {
    description: 'External Knowledge Base API Key',
    example: 'kb_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    validate: (value) => value.length > 20
  }
};

const OPTIONAL_VARS = {
  N8N_CRAWL_WEBHOOK: {
    description: 'n8n Crawl Webhook URL',
    example: 'https://your-n8n-instance.com/webhook/crawl',
    validate: (value) => value.startsWith('https://') && value.includes('webhook')
  }
};

function checkEnvironmentVariables() {
  console.log('🔍 Checking Environment Variables...\n');
  
  let allValid = true;
  let configuredCount = 0;
  
  // Check required variables
  console.log('📋 Required Variables:');
  for (const [varName, config] of Object.entries(REQUIRED_VARS)) {
    const value = process.env[varName];
    
    if (!value) {
      console.log(`   ❌ ${varName}: NOT SET`);
      console.log(`      Description: ${config.description}`);
      console.log(`      Example: ${config.example}\n`);
      allValid = false;
    } else if (value.includes('your_') || value.trim() === '') {
      console.log(`   ⚠️  ${varName}: PLACEHOLDER VALUE`);
      console.log(`      Current: ${value}`);
      console.log(`      Description: ${config.description}`);
      console.log(`      Example: ${config.example}\n`);
      allValid = false;
    } else {
      const isValid = config.validate(value);
      if (isValid) {
        console.log(`   ✅ ${varName}: CONFIGURED`);
        console.log(`      Value: ${value.substring(0, 30)}...`);
        console.log(`      Description: ${config.description}\n`);
        configuredCount++;
      } else {
        console.log(`   ⚠️  ${varName}: INVALID FORMAT`);
        console.log(`      Value: ${value.substring(0, 30)}...`);
        console.log(`      Description: ${config.description}`);
        console.log(`      Example: ${config.example}\n`);
        allValid = false;
      }
    }
  }
  
  // Check optional variables
  console.log('📋 Optional Variables:');
  for (const [varName, config] of Object.entries(OPTIONAL_VARS)) {
    const value = process.env[varName];
    
    if (!value || value.includes('your_') || value.trim() === '') {
      console.log(`   ⚠️  ${varName}: NOT CONFIGURED (optional)`);
      console.log(`      Description: ${config.description}`);
      console.log(`      Example: ${config.example}\n`);
    } else {
      const isValid = config.validate(value);
      if (isValid) {
        console.log(`   ✅ ${varName}: CONFIGURED`);
        console.log(`      Value: ${value.substring(0, 50)}...`);
        console.log(`      Description: ${config.description}\n`);
      } else {
        console.log(`   ⚠️  ${varName}: INVALID FORMAT`);
        console.log(`      Value: ${value.substring(0, 30)}...`);
        console.log(`      Description: ${config.description}`);
        console.log(`      Example: ${config.example}\n`);
      }
    }
  }
  
  // Summary
  console.log('=' * 60);
  console.log('📊 Summary:');
  console.log(`   Required variables configured: ${configuredCount}/${Object.keys(REQUIRED_VARS).length}`);
  console.log(`   All required variables valid: ${allValid ? '✅ YES' : '❌ NO'}`);
  
  if (allValid) {
    console.log('\n🎉 Environment configuration is ready!');
    console.log('\n🚀 Next steps:');
    console.log('   1. Run: npm install');
    console.log('   2. Run: npm run dev');
    console.log('   3. Open: http://localhost:3000');
  } else {
    console.log('\n⚠️  Please fix the issues above before proceeding.');
    console.log('\n🔧 Common issues:');
    console.log('   - Copy values from your service dashboards');
    console.log('   - Remove placeholder text (your_...)');
    console.log('   - Ensure URLs are complete and valid');
    console.log('   - Check that API keys are correctly formatted');
  }
  
  return allValid;
}

// Run check if this file is executed directly
if (require.main === module) {
  checkEnvironmentVariables();
}

module.exports = { checkEnvironmentVariables };
