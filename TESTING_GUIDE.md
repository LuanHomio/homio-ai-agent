# 🧪 Guia de Testes - Knowledge Base MVP

Este guia te ajudará a testar se todas as configurações estão funcionando corretamente.

## 📋 **Passo 1: Verificar Variáveis de Ambiente**

Execute o comando para verificar se todas as variáveis estão configuradas:

```bash
npm run check-env
```

### ✅ **O que esperar:**
- Todas as variáveis obrigatórias marcadas como "CONFIGURED"
- Formato das URLs e chaves API validado
- Mensagem "Environment configuration is ready!"

### ❌ **Se houver problemas:**
- Verifique se copiou os valores corretos dos dashboards
- Confirme se removeu textos placeholder (your_...)
- Valide se as URLs estão completas

## 📋 **Passo 2: Instalar Dependências**

```bash
npm install
```

### ✅ **O que esperar:**
- Instalação sem erros
- Todas as dependências instaladas

### ❌ **Se houver problemas:**
- Verifique conexão com internet
- Tente `npm cache clean --force`
- Instale dependências manualmente se necessário

## 📋 **Passo 3: Testar Conexões (Opcional)**

Execute o teste completo de integração:

```bash
npm run test-config
```

**Nota:** Este teste faz requisições reais para as APIs. Só execute se quiser testar as conexões.

### ✅ **O que esperar:**
- Supabase: ✅ PASS
- Firecrawl: ✅ PASS  
- Dify: ✅ PASS
- Database Tables: ✅ PASS

### ❌ **Se houver problemas:**
- Verifique se as API keys estão corretas
- Confirme se os serviços estão acessíveis
- Teste manualmente no dashboard de cada serviço

## 📋 **Passo 4: Executar o Projeto**

```bash
npm run dev
```

### ✅ **O que esperar:**
- Servidor iniciando na porta 3000
- Mensagem: "Ready - started server on 0.0.0.0:3000"
- Sem erros de compilação

### ❌ **Se houver problemas:**
- Verifique logs de erro no terminal
- Confirme se as variáveis de ambiente estão carregadas
- Teste com `npm run check-env` novamente

## 📋 **Passo 5: Testar Interface**

Abra http://localhost:3000 no navegador

### ✅ **O que esperar:**
- Página carrega sem erros
- 3 cards visíveis (Sources, Crawler, FAQs)
- Interface responsiva e funcional

### ❌ **Se houver problemas:**
- Verifique console do navegador (F12)
- Confirme se o servidor está rodando
- Teste em modo incógnito

## 📋 **Passo 6: Testar Funcionalidades**

### 6.1 Testar Criação de Fonte

1. **No Card 1 (Knowledge Sources):**
   - Digite uma URL válida (ex: https://example.com)
   - Selecione escopo: "Single Page"
   - Defina profundidade: 1
   - Clique "Add Source"

### ✅ **O que esperar:**
- Mensagem de sucesso verde
- Fonte aparece na lista "Existing Sources"
- Dados salvos no Supabase

### 6.2 Testar FAQ

1. **No Card 3 (FAQs):**
   - Digite uma pergunta
   - Digite uma resposta
   - Clique "Add FAQ"

### ✅ **O que esperar:**
- FAQ aparece na lista
- Dados salvos no Supabase
- Possibilidade de editar/deletar

### 6.3 Testar Crawler (Opcional)

1. **No Card 2 (Web Crawler):**
   - Selecione uma fonte criada
   - Escolha modo "Direct (Firecrawl)"
   - Clique "Start Crawl"

### ✅ **O que esperar:**
- Job ID gerado
- Status muda para "running"
- Após alguns segundos, status "success" ou "error"

**Nota:** Este teste requer API key válida do Firecrawl.

## 📋 **Passo 7: Verificar Banco de Dados**

1. **Acesse Supabase Dashboard:**
   - Vá para Table Editor
   - Verifique as tabelas criadas

### ✅ **O que esperar:**
- Tabela `kb_sources` com dados inseridos
- Tabela `faqs` com dados inseridos
- Tabela `crawl_jobs` (se testou crawler)

## 🚨 **Troubleshooting**

### Problema: "Environment configuration not ready"
**Solução:**
1. Execute `npm run check-env`
2. Corrija variáveis marcadas como ❌ ou ⚠️
3. Verifique formato das URLs e API keys

### Problema: "Failed to fetch sources"
**Solução:**
1. Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE
2. Confirme se o projeto Supabase está ativo
3. Teste conexão no Supabase Dashboard

### Problema: "Crawl failed"
**Solução:**
1. Verifique FIRECRAWL_API_KEY
2. Confirme se a API key está válida
3. Teste com uma URL simples (ex: https://example.com)

### Problema: Interface não carrega
**Solução:**
1. Verifique se `npm run dev` está rodando
2. Confirme porta 3000 não está ocupada
3. Teste em outro navegador

### Problema: Erros de TypeScript
**Solução:**
1. Execute `npx tsc --noEmit`
2. Verifique se todas as dependências estão instaladas
3. Confirme se os tipos estão corretos

## 📊 **Checklist de Testes**

- [ ] `npm run check-env` - Todas variáveis configuradas
- [ ] `npm install` - Dependências instaladas
- [ ] `npm run dev` - Servidor iniciando
- [ ] Interface carrega em http://localhost:3000
- [ ] Criação de fonte funciona
- [ ] Criação de FAQ funciona
- [ ] Dados aparecem no Supabase Dashboard
- [ ] Crawler funciona (se API key válida)

## 🎯 **Resultado Esperado**

Se todos os testes passarem:
- ✅ **Configuração completa e funcional**
- ✅ **Pronto para uso em produção**
- ✅ **Todas as integrações funcionando**

---

**Execute os testes na ordem e verifique cada passo. Se algum teste falhar, consulte a seção de troubleshooting.**
