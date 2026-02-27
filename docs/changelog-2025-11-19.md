# Changelog - 19 de Novembro de 2025

## Features Implementadas

### 1. Validação Automática de Links
- **Arquivo:** `src/lib/link-validator.ts`
- **Funcionalidade:** Valida todos os links gerados pelo agente antes do envio
- **Comportamento:** Remove ou substitui links que retornam 404/erro por mensagem "(link indisponível)"
- **Suporta:** Links em Markdown `[texto](url)`, backticks `` `url` ``, e URLs soltas

### 2. Suporte a Visão (Vision) no Gemini
- **Arquivo:** `src/lib/gemini.ts`
- **Funcionalidade:** Agente agora pode analisar imagens enviadas pelos clientes
- **Uso:** Prints de erro, screenshots, fotos
- **Modelo:** Atualizado para `gemini-1.5-flash` (suporta visão multimodal)
- **Processamento:** Download automático de imagens e conversão para base64

### 3. Extrator de Imagens
- **Arquivo:** `src/lib/image-extractor.ts`
- **Funcionalidade:** Extrai URLs de imagens do payload do GoHighLevel
- **Formatos suportados:** `media`, `attachments`, `mediaUrl`, URLs no corpo da mensagem

### 4. Busca Vetorial (Vector Search)
- **Implementação:** Substituição de busca textual por busca vetorial usando embeddings
- **Modelo:** `text-embedding-3-small` via OpenRouter (1536 dimensões)
- **Fallback:** Mantém busca textual como fallback se vetorial falhar
- **Arquivos:** `src/app/api/inbound/jobs/[id]/process/route.ts`, `src/app/api/inbound/process/route.ts`, `src/app/api/dify/retrieval/route.ts`

### 5. Geração de Embeddings para Dados Existentes
- **Endpoint:** `src/app/api/kb/embeddings/generate/route.ts`
- **Funcionalidade:** Gera embeddings para `knowledge_items` que não possuem
- **Processamento:** Batch processing com controle de limite
- **Status:** 108 itens processados com sucesso

### 6. Histórico de Conversas
- **Funcionalidade:** Agente agora recupera e usa histórico de mensagens anteriores
- **Limite:** Últimas 10 interações da mesma conversa
- **Formato:** Alterna mensagens user/model para contexto completo
- **Arquivos:** Função `retrieveMessageHistory` nos arquivos de processamento

### 7. Melhorias no System Prompt
- **Arquivo:** `src/lib/prompt-formatter.ts`
- **Instruções reforçadas:** Proibição explícita de inventar URLs
- **Instruções de visão:** Como processar imagens e prints de erro
- **Exemplos:** Casos de erro comuns documentados no prompt

### 8. Inclusão de URLs no Contexto RAG
- **Funcionalidade:** URLs da knowledge base agora são passados explicitamente no contexto
- **Formato:** `URL de referência: [url]` anexado ao conteúdo
- **Objetivo:** Garantir que agente use apenas URLs reais da base de conhecimento

## Melhorias Técnicas

- **Modelo Gemini:** Corrigido de `gemini-2.5-flash` (inexistente) para `gemini-1.5-flash`
- **Conversão Base64:** Implementada sem dependência de `Buffer` (compatível com Edge Runtime)
- **Validação de Links:** Timeout de 2s por link para não travar o chat
- **Logs:** Adicionados logs informativos sobre processamento de imagens e validação de links

## Arquivos Criados/Modificados

### Novos Arquivos
- `src/lib/link-validator.ts`
- `src/lib/image-extractor.ts`
- `src/lib/ai.ts` (função `generateEmbedding`)
- `src/app/api/kb/embeddings/generate/route.ts`

### Arquivos Modificados
- `src/lib/gemini.ts`
- `src/lib/prompt-formatter.ts`
- `src/app/api/inbound/jobs/[id]/process/route.ts`
- `src/app/api/inbound/process/route.ts`
- `src/app/api/dify/retrieval/route.ts`

