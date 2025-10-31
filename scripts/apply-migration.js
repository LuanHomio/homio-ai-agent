#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the migration file
const migrationPath = path.join(__dirname, '..', 'migrations', '003_add_locations_and_agents.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('📋 Migração SQL para Locations e Agents:');
console.log('=====================================');
console.log();
console.log(migrationSQL);
console.log();
console.log('📝 INSTRUÇÕES PARA APLICAR A MIGRAÇÃO:');
console.log('=====================================');
console.log();
console.log('1. Acesse o Supabase Dashboard: https://supabase.com/dashboard');
console.log('2. Vá para o seu projeto: wjuigblcflvwmybmrldq');
console.log('3. Clique em "SQL Editor" no menu lateral');
console.log('4. Cole o SQL acima no editor');
console.log('5. Clique em "Run" para executar a migração');
console.log();
console.log('⚠️  ATENÇÃO:');
console.log('- Esta migração criará as tabelas locations e agents');
console.log('- Adicionará colunas agent_id às tabelas existentes');
console.log('- Criará uma location e agent padrão para dados existentes');
console.log('- Ative RLS em todas as tabelas');
console.log();
console.log('✅ Após aplicar a migração, reinicie o servidor de desenvolvimento');
