#!/usr/bin/env node

/**
 * Create .env.local file from env.example
 */

const fs = require('fs');
const path = require('path');

function createEnvLocal() {
  const envExamplePath = path.join(process.cwd(), 'env.example');
  const envLocalPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envExamplePath)) {
    console.log('❌ env.example file not found');
    process.exit(1);
  }
  
  if (fs.existsSync(envLocalPath)) {
    console.log('✅ .env.local already exists');
    return;
  }
  
  try {
    const envContent = fs.readFileSync(envExamplePath, 'utf8');
    fs.writeFileSync(envLocalPath, envContent);
    console.log('✅ Created .env.local file');
    console.log('📝 Now edit .env.local with your actual credentials');
  } catch (error) {
    console.log('❌ Failed to create .env.local:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  createEnvLocal();
}

module.exports = { createEnvLocal };
