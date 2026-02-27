# Análise Completa do Fluxo do Sistema

## 📋 Resumo Executivo

Esta análise examina o fluxo atual do sistema de processamento de mensagens, incluindo:
- Criação de novas conversas
- Tratamento de múltiplas mensagens em poucos segundos
- Consulta às bases de conhecimento
- Limites e configurações
- Código não utilizado

---

## 🔄 1. FLUXO DE NOVA CONVERSA

### Estado Atual

**❌ PROBLEMA IDENTIFICADO: Conversas não são criadas automaticamente**

No arquivo `supabase/functions/inbound-webhook/index.ts` (linha 578):
```typescript
const convs = await sb(`conversations?conversation_id=eq.${conversationId}&select=agent_enabled`);
if (convs?.[0]?.agent_enabled !== true) return new Response("Disabled", { headers: corsHeaders });
```

**O que acontece:**
1. O sistema verifica se a conversa existe na tabela `conversations`
2. Se não existir, `convs[0]` será `undefined`
3. A condição `convs?.[0]?.agent_enabled !== true` será `true`
4. O webhook retorna "Disabled" e a mensagem é ignorada

**Impacto:**
- Mensagens de conversas novas são rejeitadas
- Apenas conversas já existentes e com `agent_enabled = true` são processadas

**Dados do Banco:**
- Total de conversas: 66
- Conversas habilitadas: 1
- Taxa de conversas habilitadas: 1.5%

### Recomendação

Implementar criação automática de conversas quando não existirem:

```typescript
let convs = await sb(`conversations?conversation_id=eq.${conversationId}&select=agent_enabled`);
if (!convs || convs.length === 0) {
  // Criar conversa automaticamente
  await sb("conversations", "POST", { 
    conversation_id: conversationId, 
    agent_enabled: true 
  });
  convs = [{ agent_enabled: true }];
}
if (convs[0]?.agent_enabled !== true) return new Response("Disabled", { headers: corsHeaders });
```

---

## ⚡ 2. MÚLTIPLAS MENSAGENS EM POUCOS SEGUNDOS

### Sistema de Debounce e Batching

**Arquivo principal:** `supabase/functions/inbound-webhook/index.ts`

**Mecanismo implementado:**

1. **Debounce de 15 segundos** (linha 588):
   ```typescript
   const sch = new Date(now.getTime() + 15000).toISOString();
   ```

2. **Sistema de Batches** (linhas 590-593):
   - Verifica se existe batch pendente para a conversa
   - Se existir, atualiza o `scheduled_at` para +15 segundos
   - Se não existir, cria novo batch
   - Todas as mensagens recebidas no período são agrupadas no mesmo batch

3. **Lock para evitar race conditions** (linha 595):
   ```typescript
   const lock = await sbRpc('acquire_specific_batch_lock', { ... });
   ```

4. **Processamento em background** (linhas 598-616):
   - Aguarda até o `scheduled_at` ser atingido
   - Processa todas as mensagens do batch de uma vez
   - Usa `EdgeRuntime.waitUntil()` para processamento assíncrono

### Limites e Comportamento

**Limite de espera:** 25 iterações de 2 segundos = máximo 50 segundos de espera

**Agrupamento:**
- Todas as mensagens recebidas dentro de 15 segundos são agrupadas
- O texto é combinado: `jobs.map(j => j.message_text).join("\n\n")`
- Uma única resposta é gerada para todo o batch

### Análise do Código de Processamento

**No `runBatch` (linha 183-555):**
- Busca até 20 itens da knowledge base (linha 206): `limit=20`
- Usa apenas os primeiros 10 itens para contexto (linha 234): `slice(-10)`
- Não há busca vetorial - apenas busca simples por `knowledge_base_id`

**⚠️ PROBLEMA:** A busca na knowledge base no `inbound-webhook` é muito simples:
```typescript
const items = kbIds.length ? await sb(`knowledge_items?knowledge_base_id=in.(${kbIds.join(',')})&limit=20`) : [];
```

Não usa:
- Busca vetorial (embeddings)
- Busca textual (full-text search)
- Similaridade semântica

---

## 🔍 3. CONSULTA ÀS BASES DE CONHECIMENTO

### Fluxo Atual

**Existem DOIS fluxos diferentes:**

#### A) Fluxo Principal (inbound-webhook) - ATIVO

**Arquivo:** `supabase/functions/inbound-webhook/index.ts`

**Busca implementada:**
```typescript
const items = kbIds.length 
  ? await sb(`knowledge_items?knowledge_base_id=in.(${kbIds.join(',')})&limit=20`) 
  : [];
```

**Características:**
- ❌ Não usa embeddings
- ❌ Não usa busca vetorial
- ❌ Não usa busca textual
- ✅ Apenas busca simples por `knowledge_base_id`
- ✅ Limite: 20 itens
- ✅ Usa apenas 10 itens no contexto final

#### B) Fluxo Alternativo (API Routes) - NÃO UTILIZADO NO FLUXO PRINCIPAL

**Arquivos:**
- `src/app/api/inbound/process/route.ts`
- `src/app/api/inbound/jobs/[id]/process/route.ts`

**Busca implementada:**
```typescript
// 1. Tenta busca vetorial
const { data: vectorItems } = await supabase.rpc('search_knowledge_items', {
  query_embedding: queryEmbedding,
  kb_ids: knowledgeBaseIds,
  content_types: ['faq', 'chunk'],
  top_k: 10,
  similarity_threshold: 0.7
});

// 2. Fallback para busca textual
const { data: textItems } = await supabase.rpc('search_knowledge_items_text', {
  query_text: query,
  kb_ids: knowledgeBaseIds,
  content_types: ['faq', 'chunk'],
  top_k: 10
});

// 3. Fallback final: busca simples
const { data: fallbackItems } = await supabase
  .from('knowledge_items')
  .select('content, title, url, content_type, id')
  .in('knowledge_base_id', knowledgeBaseIds)
  .limit(10);
```

**Características:**
- ✅ Usa embeddings (OpenRouter API)
- ✅ Busca vetorial com similaridade
- ✅ Fallback para busca textual
- ✅ Limite: 10 itens (top_k)
- ✅ Threshold de similaridade: 0.7

### Funções RPC Disponíveis

**1. `search_knowledge_items` (Busca Vetorial)**
- Parâmetros: `query_embedding`, `kb_ids`, `content_types`, `top_k`, `similarity_threshold`
- Retorna: Itens ordenados por similaridade (cosine distance)
- Threshold padrão: 0.7

**2. `search_knowledge_items_text` (Busca Textual)**
- Parâmetros: `query_text`, `kb_ids`, `content_types`, `top_k`
- Retorna: Itens que contêm o texto (ILIKE)
- Ordenação: Por `created_at DESC`

### Limites Configurados

| Fluxo | Limite de Busca | Limite de Uso | Método |
|-------|----------------|---------------|---------|
| inbound-webhook | 20 itens | 10 itens | Busca simples |
| API Routes | 10 itens (top_k) | 5 itens | Busca vetorial/textual |

### Problema Identificado

**O fluxo principal (inbound-webhook) não está usando as funções RPC avançadas!**

O código mais sofisticado está apenas nas API routes que não são chamadas pelo fluxo principal.

---

## 🗑️ 4. CÓDIGO NÃO UTILIZADO

### Edge Functions Desabilitadas

#### A) `process-inbound-job`
**Status:** Desabilitado
**Arquivo:** `supabase/functions/process-inbound-job/index.ts`
**Código:**
```typescript
return new Response(JSON.stringify({ message: "disabled" }), {
  status: 200,
  headers: { ...corsHeaders, "Content-Type": "application/json" }
});
```

**Motivo:** O processamento foi movido para dentro do `inbound-webhook` usando `runBatch`.

#### B) `process-scheduled-jobs`
**Status:** Desabilitado
**Arquivo:** `supabase/functions/process-scheduled-jobs/index.ts`
**Código:**
```typescript
return new Response(JSON.stringify({ message: "disabled" }), {
  status: 200,
  headers: { ...corsHeaders, "Content-Type": "application/json" }
});
```

**Motivo:** O processamento agendado foi movido para dentro do `inbound-webhook` usando `EdgeRuntime.waitUntil()`.

### API Routes Não Utilizadas no Fluxo Principal

#### A) `/api/inbound/process`
**Arquivo:** `src/app/api/inbound/process/route.ts`
**Status:** Existe mas não é chamada pelo fluxo principal
**Uso:** Apenas se chamada manualmente via HTTP

**Características:**
- ✅ Implementa busca vetorial
- ✅ Implementa debounce (3 segundos)
- ✅ Agrupa mensagens
- ❌ Não é usada pelo webhook principal

#### B) `/api/inbound/jobs/[id]/process`
**Arquivo:** `src/app/api/inbound/jobs/[id]/process/route.ts`
**Status:** Existe mas não é chamada pelo fluxo principal
**Uso:** Apenas para processamento manual de jobs específicos

**Características:**
- ✅ Implementa busca vetorial
- ✅ Processa job individual
- ❌ Não é usada pelo webhook principal

### Integração Dify

**Status:** Implementada mas não utilizada no fluxo principal

**Arquivos relacionados:**
- `src/lib/dify.ts` - Cliente Dify
- `src/app/api/dify/datasets/route.ts` - API de datasets
- `src/app/api/dify/retrieval/route.ts` - API de retrieval

**Uso atual:**
- Campo `dify_app_id` existe na tabela `agents`
- Interface permite configurar `dify_app_id`
- Mas não é usado no processamento de mensagens

**Recomendação:**
- Se não for usar Dify, considerar remover ou documentar como feature futura
- Se for usar, integrar no fluxo principal

### Código Compartilhado Não Utilizado

**Arquivo:** `supabase/functions/_shared/processing.ts`

**Funções disponíveis:**
- `retrieveContext()` - Busca contexto (usa busca simples, não vetorial)
- `generateSystemPrompt()` - Gera system prompt
- `getConversationHistory()` - Busca histórico da conversa
- `processBatch()` - Processa batch (não usado)

**Status:** Código existe mas o `inbound-webhook` implementa sua própria lógica inline.

---

## 📊 5. ESTATÍSTICAS DO BANCO DE DADOS

### Conversas
- Total: 66
- Habilitadas: 1 (1.5%)
- Desabilitadas: 65 (98.5%)

### Jobs
- Total: 127
- Completed: 97 (76.4%)
- Pending: 28 (22.0%)
- Error: 1 (0.8%)
- Cancelled: 1 (0.8%)

### Knowledge Items
- Total: 108 itens
- Distribuídos em 5 knowledge bases

---

## 🎯 6. RECOMENDAÇÕES PRIORITÁRIAS

### 🔴 CRÍTICO

1. **Criar conversas automaticamente**
   - Implementar criação quando não existir
   - Habilitar por padrão (`agent_enabled = true`)

2. **Melhorar busca na knowledge base no fluxo principal**
   - Implementar busca vetorial no `inbound-webhook`
   - Usar as funções RPC `search_knowledge_items` e `search_knowledge_items_text`
   - Reduzir limite de 20 para 10 itens (mais relevante)

### 🟡 IMPORTANTE

3. **Limpar código não utilizado**
   - Remover ou documentar edge functions desabilitadas
   - Decidir sobre uso do Dify (remover ou integrar)
   - Consolidar lógica de busca (evitar duplicação)

4. **Otimizar limites**
   - Reduzir limite de busca de 20 para 10 itens
   - Ajustar threshold de similaridade se necessário
   - Documentar limites e comportamento

### 🟢 MELHORIAS

5. **Documentação**
   - Documentar fluxo completo de processamento
   - Documentar sistema de batches e debounce
   - Documentar limites e configurações

6. **Monitoramento**
   - Adicionar logs para criação de conversas
   - Monitorar taxa de uso de busca vetorial vs textual
   - Rastrear tempo de processamento de batches

---

## 📝 7. RESUMO TÉCNICO

### Fluxo Atual (inbound-webhook)

```
1. Webhook recebe mensagem
2. Verifica se conversa existe e está habilitada ❌ (falha se não existir)
3. Busca agente ativo para a location
4. Busca knowledge bases do agente
5. Cria/atualiza batch (debounce 15s)
6. Cria job pendente
7. Tenta adquirir lock
8. Se conseguir lock, processa em background:
   - Aguarda scheduled_at
   - Busca 20 itens da KB (busca simples) ❌ (não usa vetorial)
   - Usa apenas 10 itens
   - Busca histórico da conversa (GHL API)
   - Gera resposta com Gemini
   - Envia resposta para GHL
```

### Fluxo Ideal (com melhorias)

```
1. Webhook recebe mensagem
2. Verifica se conversa existe
   - Se não existir, cria automaticamente ✅
3. Verifica se conversa está habilitada
4. Busca agente ativo para a location
5. Busca knowledge bases do agente
6. Cria/atualiza batch (debounce 15s)
7. Cria job pendente
8. Tenta adquirir lock
9. Se conseguir lock, processa em background:
   - Aguarda scheduled_at
   - Gera embedding da query ✅
   - Busca vetorial (top 10, threshold 0.7) ✅
   - Fallback para busca textual se necessário ✅
   - Usa top 5 itens mais relevantes ✅
   - Busca histórico da conversa (GHL API)
   - Gera resposta com Gemini
   - Envia resposta para GHL
```

---

## 🔧 8. PRÓXIMOS PASSOS SUGERIDOS

1. ✅ Implementar criação automática de conversas
2. ✅ Migrar busca da KB para usar funções RPC (vetorial/textual)
3. ✅ Reduzir limite de busca de 20 para 10 itens
4. ✅ Limpar código não utilizado (edge functions desabilitadas)
5. ✅ Decidir sobre Dify (remover ou integrar)
6. ✅ Adicionar logs e monitoramento
7. ✅ Documentar fluxo completo

---

**Data da Análise:** 2025-01-20
**Versão do Sistema:** Baseado em código atual do repositório
