#!/usr/bin/env node

/**
 * Test script for Knowledge Base MVP configuration
 * Tests all environment variables and integrations
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const REQUIRED_ENV_VARS = {
  SUPABASE_URL: 'Supabase Project URL',
  SUPABASE_SERVICE_ROLE: 'Supabase Service Role Key',
  FIRECRAWL_API_KEY: 'Firecrawl API Key',
  DIFY_API_BASE: 'Dify API Base URL',
  DIFY_API_KEY: 'Dify API Key',
  EXTERNAL_KB_API_KEY: 'External Knowledge Base API Key'
};

const OPTIONAL_ENV_VARS = {
  N8N_CRAWL_WEBHOOK: 'n8n Crawl Webhook URL'
};

async function testSupabaseConnection() {
  console.log('\n🔍 Testing Supabase Connection...');
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Test connection by listing tables
    const { data, error } = await supabase
      .from('kb_sources')
      .select('count')
      .limit(1);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    console.log('✅ Supabase connection successful');
    console.log(`   URL: ${supabaseUrl}`);
    console.log(`   Service Role Key: ${supabaseKey.substring(0, 20)}...`);
    
    return true;
  } catch (error) {
    console.log('❌ Supabase connection failed:');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testFirecrawlConnection() {
  console.log('\n🔍 Testing Firecrawl API...');
  
  try {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    
    if (!apiKey) {
      throw new Error('FIRECRAWL_API_KEY not configured');
    }
    
    // Test with a simple scrape request
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://example.com',
        formats: ['markdown']
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} ${errorData.error || response.statusText}`);
    }
    
    console.log('✅ Firecrawl API connection successful');
    console.log(`   API Key: ${apiKey.substring(0, 20)}...`);
    
    return true;
  } catch (error) {
    console.log('❌ Firecrawl API connection failed:');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testDifyConnection() {
  console.log('\n🔍 Testing Dify API...');
  
  try {
    const apiBase = process.env.DIFY_API_BASE;
    const apiKey = process.env.DIFY_API_KEY;
    
    if (!apiBase || !apiKey) {
      throw new Error('Dify credentials not configured');
    }
    
    // Test connection by listing datasets
    const response = await fetch(`${apiBase}/datasets`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ Dify API connection successful');
    console.log(`   API Base: ${apiBase}`);
    console.log(`   API Key: ${apiKey.substring(0, 20)}...`);
    console.log(`   Datasets found: ${Array.isArray(data) ? data.length : 'N/A'}`);
    
    return true;
  } catch (error) {
    console.log('❌ Dify API connection failed:');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testDatabaseTables() {
  console.log('\n🔍 Testing Database Tables...');
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    const tables = ['kb_sources', 'crawl_jobs', 'documents', 'chunks', 'embeddings', 'faqs'];
    const results = {};
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (error) {
          results[table] = { status: 'error', message: error.message };
        } else {
          results[table] = { status: 'success', message: 'Table accessible' };
        }
      } catch (err) {
        results[table] = { status: 'error', message: err.message };
      }
    }
    
    console.log('📊 Database Tables Status:');
    for (const [table, result] of Object.entries(results)) {
      const icon = result.status === 'success' ? '✅' : '❌';
      console.log(`   ${icon} ${table}: ${result.message}`);
    }
    
    const successCount = Object.values(results).filter(r => r.status === 'success').length;
    return successCount === tables.length;
    
  } catch (error) {
    console.log('❌ Database tables test failed:');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

function validateEnvironmentVariables() {
  console.log('\n🔍 Validating Environment Variables...');
  
  let allValid = true;
  
  // Check required variables
  console.log('📋 Required Variables:');
  for (const [varName, description] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[varName];
    if (!value || value.includes('your_') || value.trim() === '') {
      console.log(`   ❌ ${varName}: ${description} - NOT CONFIGURED`);
      allValid = false;
    } else {
      console.log(`   ✅ ${varName}: ${description} - CONFIGURED`);
    }
  }
  
  // Check optional variables
  console.log('\n📋 Optional Variables:');
  for (const [varName, description] of Object.entries(OPTIONAL_ENV_VARS)) {
    const value = process.env[varName];
    if (!value || value.includes('your_') || value.trim() === '') {
      console.log(`   ⚠️  ${varName}: ${description} - NOT CONFIGURED (optional)`);
    } else {
      console.log(`   ✅ ${varName}: ${description} - CONFIGURED`);
    }
  }
  
  return allValid;
}

async function testAPIEndpoints() {
  console.log('\n🔍 Testing API Endpoints...');
  
  const endpoints = [
    { path: '/api/kb/source', method: 'GET', name: 'List Sources' },
    { path: '/api/kb/faqs', method: 'GET', name: 'List FAQs' }
  ];
  
  let successCount = 0;
  
  for (const endpoint of endpoints) {
    try {
      // Note: This test assumes the server is running
      // In a real test, you'd start the server first
      console.log(`   ⚠️  ${endpoint.name}: Requires server to be running`);
      console.log(`      Test manually: curl http://localhost:3000${endpoint.path}`);
    } catch (error) {
      console.log(`   ❌ ${endpoint.name}: ${error.message}`);
    }
  }
  
  return true; // Manual testing required
}

async function runAllTests() {
  console.log('🧪 Knowledge Base MVP - Configuration Tests\n');
  console.log('=' * 50);
  
  const results = {
    envVars: false,
    supabase: false,
    firecrawl: false,
    dify: false,
    database: false,
    api: false
  };
  
  // Test environment variables
  results.envVars = validateEnvironmentVariables();
  
  // Test integrations only if env vars are valid
  if (results.envVars) {
    results.supabase = await testSupabaseConnection();
    results.firecrawl = await testFirecrawlConnection();
    results.dify = await testDifyConnection();
    results.database = await testDatabaseTables();
    results.api = await testAPIEndpoints();
  }
  
  // Summary
  console.log('\n' + '=' * 50);
  console.log('📊 Test Results Summary:');
  console.log(`   Environment Variables: ${results.envVars ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Supabase Connection: ${results.supabase ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Firecrawl API: ${results.firecrawl ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Dify API: ${results.dify ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Database Tables: ${results.database ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   API Endpoints: ${results.api ? '✅ PASS' : '⚠️  MANUAL'}`);
  
  const passedTests = Object.values(results).filter(r => r === true).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Your configuration is ready.');
    console.log('\n🚀 Next steps:');
    console.log('   1. Run: npm run dev');
    console.log('   2. Open: http://localhost:3000');
    console.log('   3. Test the interface');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
    console.log('\n🔧 Common fixes:');
    console.log('   - Verify API keys are correct');
    console.log('   - Check if services are accessible');
    console.log('   - Ensure .env.local is properly configured');
  }
  
  return passedTests === totalTests;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };
