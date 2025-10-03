# Knowledge Base MVP

Um MVP completo de Knowledge Base + Web Crawler + FAQs para negócios de consignado (INSS portabilidade) e FGTS, com integração ao Dify para alimentar agentes de IA.

## 🚀 Funcionalidades

- **Cadastro de Fontes**: Gerencie URLs para crawl
- **Web Crawler Dual**: Modo direto (Firecrawl) e via n8n webhook
- **CRUD de FAQs**: Interface completa para gerenciar perguntas frequentes
- **Status de Jobs**: Acompanhe o progresso dos crawls em tempo real
- **Integração Dify**: Duas formas de integração (Datasets nativos + External Knowledge API)
- **Supabase + pgvector**: Banco preparado para RAG com embeddings

## 🛠️ Stack Tecnológica

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase JS Client
- **Banco**: Supabase (PostgreSQL + pgvector)
- **Crawler**: Firecrawl (SDK) + n8n (webhook)
- **IA**: Dify (Datasets + External Knowledge API)

## 📋 Pré-requisitos

- Node.js 18+
- Conta Supabase
- API Key do Firecrawl
- n8n instance (opcional)
- Dify instance

## ⚙️ Configuração

### 1. Clone e instale dependências

\`\`\`bash
git clone <repository-url>
cd knowledge-base
npm install
\`\`\`

### 2. Configure variáveis de ambiente

Copie \`env.example\` para \`.env.local\`:

\`\`\`bash
cp env.example .env.local
\`\`\`

Configure as variáveis:

\`\`\`env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your_service_role_key_here

# Firecrawl API
FIRECRAWL_API_KEY=your_firecrawl_api_key_here

# n8n Webhook (opcional)
N8N_CRAWL_WEBHOOK=https://your-n8n-instance.com/webhook/crawl

# Dify Configuration
DIFY_API_BASE=https://your-dify-instance.com/v1
DIFY_API_KEY=your_dify_api_key_here
EXTERNAL_KB_API_KEY=your_external_kb_api_key_here
\`\`\`

### 3. Configure o banco Supabase

As migrações já foram aplicadas automaticamente:

- ✅ Extensão pgvector habilitada
- ✅ Tabelas criadas com RLS ativo
- ✅ Políticas de segurança configuradas

### 4. Execute o projeto

\`\`\`bash
npm run dev
\`\`\`

Acesse: http://localhost:3000

## 🗄️ Estrutura do Banco

### Tabelas Principais

- **kb_sources**: Fontes de conhecimento (URLs)
- **crawl_jobs**: Jobs de crawl com status
- **documents**: Documentos extraídos (markdown)
- **chunks**: Pedaços dos documentos para RAG
- **embeddings**: Vetores para busca semântica (futuro)
- **faqs**: Perguntas frequentes

### RLS (Row Level Security)

- **faqs**: Leitura pública, escrita via service role
- **Demais tabelas**: Acesso apenas via service role (backend)

## 🔌 Endpoints da API

### Knowledge Base

- \`POST /api/kb/source\` - Criar fonte
- \`GET /api/kb/source\` - Listar fontes
- \`POST /api/kb/crawl\` - Iniciar crawl
- \`GET /api/kb/jobs/:id\` - Status do job
- \`GET /api/kb/faqs\` - Listar FAQs
- \`POST /api/kb/faqs\` - Criar FAQ
- \`PATCH /api/kb/faqs/:id\` - Atualizar FAQ
- \`DELETE /api/kb/faqs/:id\` - Deletar FAQ

### Dify Integration

- \`GET /api/dify/datasets\` - Listar datasets
- \`POST /api/dify/datasets\` - Criar dataset
- \`POST /api/dify/retrieval\` - External Knowledge API

## 🕷️ Web Crawler

### Modo Direct (Firecrawl)

- Chamada direta à API do Firecrawl
- Retorna markdown estruturado
- Processamento em background
- Chunking automático

### Modo n8n

- Webhook para workflow n8n
- Resposta assíncrona
- Ideal para workloads longos
- Configurável via N8N_CRAWL_WEBHOOK

## 🤖 Integração Dify

### 1. Datasets Nativos

Use os endpoints \`/api/dify/datasets\` para:
- Listar datasets existentes
- Criar novos datasets
- Upload de documentos

### 2. External Knowledge API

Endpoint \`/api/dify/retrieval\`:
- Recebe queries do Dify
- Retorna chunks relevantes do Supabase
- Autenticação via Bearer token
- Formato compatível com Dify

**Como configurar no Dify:**
1. Acesse Knowledge Management
2. Adicione External Knowledge API
3. URL: \`https://your-domain.com/api/dify/retrieval\`
4. API Key: \`EXTERNAL_KB_API_KEY\`

## 📱 Interface Administrativa

### Card 1: Knowledge Sources
- Adicionar URLs
- Configurar escopo (single/path/domain)
- Definir profundidade do crawl
- Listar fontes existentes

### Card 2: Web Crawler
- Selecionar modo (direct/n8n)
- Escolher fonte para crawl
- Acompanhar status dos jobs
- Histórico de execuções

### Card 3: FAQs
- CRUD completo de FAQs
- Interface intuitiva
- Edição inline
- Validação de campos

## 🔧 Desenvolvimento

### Scripts Disponíveis

\`\`\`bash
npm run dev      # Desenvolvimento
npm run build    # Build de produção
npm run start    # Servidor de produção
npm run lint     # Linting
\`\`\`

### Estrutura de Pastas

\`\`\`
src/
├── app/                 # Next.js App Router
│   ├── api/            # API Routes
│   ├── globals.css     # Estilos globais
│   ├── layout.tsx      # Layout principal
│   └── page.tsx        # Página principal
├── components/         # Componentes React
│   └── ui/            # Componentes base
└── lib/               # Utilitários e configurações
    ├── types.ts       # Tipos TypeScript
    ├── supabase.ts    # Cliente Supabase
    ├── firecrawl.ts   # Cliente Firecrawl
    ├── dify.ts        # Cliente Dify
    └── chunking.ts    # Lógica de chunking
\`\`\`

## 🚀 Deploy

### Vercel (Recomendado)

1. Conecte seu repositório ao Vercel
2. Configure as variáveis de ambiente
3. Deploy automático

### Outras Plataformas

O projeto é compatível com qualquer plataforma que suporte Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 🔐 Segurança

- RLS ativo em todas as tabelas
- Service role apenas no backend
- Validação de entrada em todos os endpoints
- Autenticação via API keys para integrações externas

## 📊 Monitoramento

- Logs estruturados em console
- Status de jobs em tempo real
- Tratamento de erros robusto
- Mensagens de feedback na UI

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

## 🆘 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do console
2. Confirme as variáveis de ambiente
3. Teste os endpoints individualmente
4. Abra uma issue no repositório

---

**Desenvolvido para otimizar o pipeline de conhecimento e alimentar agentes de IA com dados estruturados e atualizados.**

