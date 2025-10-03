#!/usr/bin/env node

/**
 * Simple environment variables checker without dotenv dependency
 */

const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env.local file not found');
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        envVars[key] = valueParts.join('=');
      }
    }
  });
  
  return envVars;
}

const REQUIRED_VARS = {
  SUPABASE_URL: {
    description: 'Supabase Project URL',
    validate: (value) => value.startsWith('https://') && value.includes('supabase.co')
  },
  SUPABASE_SERVICE_ROLE: {
    description: 'Supabase Service Role Key',
    validate: (value) => value.length > 50 && value.startsWith('eyJ')
  },
  FIRECRAWL_API_KEY: {
    description: 'Firecrawl API Key',
    validate: (value) => value.startsWith('fc-') && value.length > 20
  },
  DIFY_API_BASE: {
    description: 'Dify API Base URL',
    validate: (value) => value.startsWith('https://') && value.includes('/v1')
  },
  DIFY_API_KEY: {
    description: 'Dify API Key',
    validate: (value) => value.length > 20
  },
  EXTERNAL_KB_API_KEY: {
    description: 'External Knowledge Base API Key',
    validate: (value) => value.length > 20
  }
};

const OPTIONAL_VARS = {
  N8N_CRAWL_WEBHOOK: {
    description: 'n8n Crawl Webhook URL',
    validate: (value) => value.startsWith('https://') && value.includes('webhook')
  }
};

function checkEnvironmentVariables() {
  console.log('🔍 Checking Environment Variables...\n');
  
  const envVars = loadEnvFile();
  let allValid = true;
  let configuredCount = 0;
  
  // Check required variables
  console.log('📋 Required Variables:');
  for (const [varName, config] of Object.entries(REQUIRED_VARS)) {
    const value = envVars[varName];
    
    if (!value) {
      console.log(`   ❌ ${varName}: NOT SET`);
      console.log(`      Description: ${config.description}\n`);
      allValid = false;
    } else if (value.includes('your_') || value.trim() === '') {
      console.log(`   ⚠️  ${varName}: PLACEHOLDER VALUE`);
      console.log(`      Current: ${value}`);
      console.log(`      Description: ${config.description}\n`);
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
        console.log(`      Description: ${config.description}\n`);
        allValid = false;
      }
    }
  }
  
  // Check optional variables
  console.log('📋 Optional Variables:');
  for (const [varName, config] of Object.entries(OPTIONAL_VARS)) {
    const value = envVars[varName];
    
    if (!value || value.includes('your_') || value.trim() === '') {
      console.log(`   ⚠️  ${varName}: NOT CONFIGURED (optional)`);
      console.log(`      Description: ${config.description}\n`);
    } else {
      const isValid = config.validate(value);
      if (isValid) {
        console.log(`   ✅ ${varName}: CONFIGURED`);
        console.log(`      Value: ${value.substring(0, 50)}...`);
        console.log(`      Description: ${config.description}\n`);
      } else {
        console.log(`   ⚠️  ${varName}: INVALID FORMAT`);
        console.log(`      Value: ${value.substring(0, 30)}...`);
        console.log(`      Description: ${config.description}\n`);
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
  }
  
  return allValid;
}

// Run check if this file is executed directly
if (require.main === module) {
  checkEnvironmentVariables();
}

module.exports = { checkEnvironmentVariables };
