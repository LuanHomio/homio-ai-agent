# Integração com Dify

Este documento descreve como integrar o Knowledge Base MVP com o Dify para alimentar agentes de IA.

## Duas Formas de Integração

### 1. Datasets Nativos do Dify

Use os datasets nativos do Dify para upload direto de documentos.

#### Endpoints Disponíveis

**Listar Datasets**
```bash
GET /api/dify/datasets
Authorization: Bearer {DIFY_API_KEY}
```

**Criar Dataset**
```bash
POST /api/dify/datasets
Authorization: Bearer {DIFY_API_KEY}
Content-Type: application/json

{
  "name": "Knowledge Base Dataset",
  "description": "Documentos do knowledge base"
}
```

**Upload de Documento**
```bash
POST /api/dify/datasets/{datasetId}/documents
Authorization: Bearer {DIFY_API_KEY}
Content-Type: application/json

{
  "name": "Document Title",
  "content": "Document content in markdown"
}
```

#### Fluxo de Integração

1. **Criar Dataset**: Use o endpoint para criar um dataset no Dify
2. **Processar Crawls**: Após cada crawl bem-sucedido, envie os documentos para o Dify
3. **Sincronizar**: Mantenha o dataset atualizado com novos crawls

### 2. External Knowledge API

Use nossa API externa para busca dinâmica no Knowledge Base.

#### Endpoint de Retrieval

**URL**: `https://your-domain.com/api/dify/retrieval`

**Autenticação**: Bearer Token (`EXTERNAL_KB_API_KEY`)

**Request**:
```json
{
  "query": "Como funciona o consignado INSS?",
  "top_k": 5,
  "filters": {
    "source_scope": "domain"
  }
}
```

**Response**:
```json
{
  "chunks": [
    {
      "content": "O consignado INSS é um empréstimo...",
      "score": 0.95,
      "metadata": {
        "chunk_id": "uuid",
        "document_url": "https://example.com/page1",
        "document_title": "Consignado INSS",
        "source_url": "https://example.com",
        "source_scope": "domain",
        "token_count": 250,
        "created_at": "2025-01-01T00:00:00Z"
      }
    }
  ]
}
```

## Configuração no Dify

### 1. External Knowledge API

1. **Acesse Dify Dashboard**
   - Vá para Knowledge Management
   - Clique em "Add Knowledge Base"

2. **Selecione External API**
   - Escolha "External Knowledge API"
   - Configure os parâmetros:

   ```
   Name: Knowledge Base API
   API Endpoint: https://your-domain.com/api/dify/retrieval
   API Key: {EXTERNAL_KB_API_KEY}
   ```

3. **Teste a Conexão**
   - Use o botão de teste
   - Confirme que retorna resultados

4. **Configure no App**
   - Adicione a Knowledge Base ao seu app
   - Configure os parâmetros de busca

### 2. Datasets Nativos

1. **Criar Dataset via API**
   ```bash
   curl -X POST https://your-dify-instance.com/v1/datasets \
     -H "Authorization: Bearer {DIFY_API_KEY}" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Knowledge Base",
       "description": "Documentos do knowledge base"
     }'
   ```

2. **Upload de Documentos**
   - Use os endpoints para enviar documentos
   - Processe resultados de crawl automaticamente

## Implementação Automática

### Sincronização com Crawls

Quando um crawl é concluído com sucesso:

1. **Para External API**: Os documentos são automaticamente indexados
2. **Para Datasets**: Envie os documentos via API

```typescript
// Exemplo de sincronização automática
async function syncWithDify(documents: Document[], mode: 'external' | 'dataset') {
  if (mode === 'dataset') {
    // Enviar para dataset nativo
    for (const doc of documents) {
      await difyClient.createDocument(datasetId, doc.title, doc.content);
    }
  }
  // Para external API, os documentos já estão indexados no Supabase
}
```

### Configuração de Chunking

O sistema usa chunking configurável:

```typescript
const chunkingOptions = {
  chunkSize: 1000,  // Tamanho do chunk em caracteres
  overlap: 200      // Sobreposição entre chunks
};
```

### Embeddings (Futuro)

Para melhorar a busca semântica:

1. **Gere Embeddings**: Use OpenAI, Cohere, ou outros provedores
2. **Armazene no Supabase**: Tabela `embeddings` com pgvector
3. **Busca Vetorial**: Implemente busca por similaridade de cosseno

```sql
-- Exemplo de busca vetorial
SELECT c.content, c.token_count, 
       1 - (e.embedding <=> query_embedding) as similarity
FROM chunks c
JOIN embeddings e ON c.id = e.chunk_id
ORDER BY similarity DESC
LIMIT 5;
```

## Monitoramento

### Métricas Importantes

1. **Tempo de Resposta**: API de retrieval deve responder < 500ms
2. **Taxa de Sucesso**: Crawls devem ter > 95% de sucesso
3. **Qualidade dos Chunks**: Chunks devem ter tamanho adequado
4. **Cobertura**: Verifique se todos os documentos estão indexados

### Logs

```typescript
// Exemplo de logging
console.log('Dify sync completed', {
  datasetId,
  documentsProcessed: documents.length,
  errors: errorCount,
  timestamp: new Date().toISOString()
});
```

## Troubleshooting

### External API não responde

1. **Verifique Autenticação**: Confirme se `EXTERNAL_KB_API_KEY` está correto
2. **Teste Endpoint**: Use curl para testar diretamente
3. **Verifique Logs**: Confira logs da aplicação

### Datasets não sincronizam

1. **Verifique API Key**: Confirme se `DIFY_API_KEY` está correto
2. **Teste Conectividade**: Verifique se consegue acessar a API do Dify
3. **Verifique Rate Limits**: Dify pode ter limites de requisições

### Busca retorna resultados irrelevantes

1. **Ajuste Chunking**: Modifique tamanho dos chunks
2. **Melhore Filtros**: Use filtros mais específicos
3. **Implemente Embeddings**: Use busca vetorial para melhor relevância

## Exemplos de Uso

### Agente de Atendimento

```typescript
// Configuração do agente para usar External API
const agentConfig = {
  knowledgeBase: {
    type: 'external_api',
    endpoint: 'https://your-domain.com/api/dify/retrieval',
    apiKey: 'your-external-kb-api-key',
    maxResults: 5,
    similarityThreshold: 0.7
  }
};
```

### Chatbot com Datasets

```typescript
// Upload automático após crawl
async function onCrawlComplete(documents: Document[]) {
  for (const doc of documents) {
    await difyClient.createDocument(
      'knowledge-base-dataset',
      doc.title,
      doc.content
    );
  }
}
```
