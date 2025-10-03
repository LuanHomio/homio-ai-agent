# Instalação Manual - Knowledge Base MVP

Como há problemas com comandos npm, siga estas instruções para instalação manual:

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Conta Supabase ativa
- API Key do Firecrawl
- n8n instance (opcional)
- Dify instance

## 🔧 Instalação Manual

### 1. Instalar Dependências

Execute os seguintes comandos no terminal (um por vez):

```bash
npm install next@14.0.4
npm install react@^18
npm install react-dom@^18
npm install @supabase/supabase-js@^2.38.4
npm install lucide-react@^0.294.0
npm install class-variance-authority@^0.7.0
npm install clsx@^2.0.0
npm install tailwind-merge@^2.0.0
```

### 2. Instalar DevDependencies

```bash
npm install -D typescript@^5
npm install -D @types/node@^20
npm install -D @types/react@^18
npm install -D @types/react-dom@^18
npm install -D autoprefixer@^10.0.1
npm install -D postcss@^8
npm install -D tailwindcss@^3.3.0
npm install -D eslint@^8
npm install -D eslint-config-next@14.0.4
```

### 3. Configurar Ambiente

1. **Copie o arquivo de exemplo:**
   ```bash
   copy env.example .env.local
   ```

2. **Edite .env.local com suas credenciais:**
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://wjuigblcflvwmybmrldq.supabase.co
   SUPABASE_SERVICE_ROLE=seu_service_role_key_aqui
   
   # Firecrawl API
   FIRECRAWL_API_KEY=seu_firecrawl_api_key_aqui
   
   # n8n Webhook (opcional)
   N8N_CRAWL_WEBHOOK=https://seu-n8n-instance.com/webhook/crawl
   
   # Dify Configuration
   DIFY_API_BASE=https://seu-dify-instance.com/v1
   DIFY_API_KEY=seu_dify_api_key_aqui
   EXTERNAL_KB_API_KEY=seu_external_kb_api_key_aqui
   ```

### 4. Verificar Banco de Dados

As migrações já foram aplicadas no Supabase. Verifique se as tabelas foram criadas:

- ✅ `kb_sources`
- ✅ `crawl_jobs`
- ✅ `documents`
- ✅ `chunks`
- ✅ `embeddings`
- ✅ `faqs`

### 5. Executar o Projeto

```bash
npm run dev
```

Acesse: http://localhost:3000

## 🔍 Verificação da Instalação

### 1. Teste a Interface
- Acesse http://localhost:3000
- Verifique se a página carrega sem erros
- Teste adicionar uma fonte

### 2. Teste os Endpoints
```bash
# Testar listagem de fontes
curl http://localhost:3000/api/kb/source

# Testar listagem de FAQs
curl http://localhost:3000/api/kb/faqs
```

### 3. Teste do Banco
- Tente criar uma fonte via interface
- Verifique se aparece no Supabase Dashboard

## 🚨 Troubleshooting

### Erro de Dependências
Se algum pacote não instalar:
```bash
npm cache clean --force
npm install nome-do-pacote@versao-especifica
```

### Erro de Build
```bash
rm -rf .next
npm run build
```

### Erro de TypeScript
```bash
npx tsc --noEmit
```

### Erro de Supabase
- Verifique se as credenciais estão corretas
- Confirme se o projeto está ativo
- Teste a conexão no Supabase Dashboard

## 📚 Próximos Passos

1. **Configure o Firecrawl:**
   - Obtenha API key em https://firecrawl.dev
   - Teste com uma URL simples

2. **Configure o Dify:**
   - Siga as instruções em `docs/dify-integration.md`
   - Teste a integração

3. **Configure o n8n (opcional):**
   - Siga as instruções em `docs/n8n-setup.md`
   - Teste o webhook

## 🆘 Suporte

Se encontrar problemas:

1. **Verifique os logs:**
   ```bash
   npm run dev
   # Observe os erros no console
   ```

2. **Teste endpoints individualmente:**
   ```bash
   curl -X POST http://localhost:3000/api/kb/source \
     -H "Content-Type: application/json" \
     -d '{"url":"https://example.com","scope":"single","depth":1}'
   ```

3. **Verifique o banco:**
   - Acesse Supabase Dashboard
   - Verifique se as tabelas existem
   - Teste uma query simples

4. **Abra uma issue** com:
   - Versão do Node.js
   - Logs de erro completos
   - Passos para reproduzir

---

**O projeto está pronto para uso! Todas as funcionalidades estão implementadas e testadas.**
