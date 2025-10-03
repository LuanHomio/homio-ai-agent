# Configuração do n8n para Web Crawler

Este documento descreve como configurar o n8n para trabalhar com o Knowledge Base MVP.

## Workflow n8n

### Estrutura do Workflow

1. **Webhook Trigger** - Recebe requisições do Knowledge Base
2. **Crawler Node** - Executa o crawl (pode usar Firecrawl, Puppeteer, etc.)
3. **Data Processing** - Processa e formata os dados
4. **Respond to Webhook** - Retorna o resultado final

### Configuração do Webhook Trigger

```json
{
  "name": "Knowledge Base Crawler",
  "type": "n8n-nodes-base.webhook",
  "parameters": {
    "httpMethod": "POST",
    "path": "crawl",
    "responseMode": "responseNode"
  }
}
```

### Payload de Entrada

O webhook receberá o seguinte payload:

```json
{
  "jobId": "uuid-do-job",
  "source": {
    "url": "https://example.com",
    "scope": "domain|path|single",
    "depth": 1
  }
}
```

### Configuração do Respond to Webhook

```json
{
  "name": "Respond to Webhook",
  "type": "n8n-nodes-base.respondToWebhook",
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ $json }}",
    "responseCode": 200,
    "responseMode": "lastNode"
  }
}
```

### Payload de Resposta

O webhook deve retornar:

```json
{
  "jobId": "uuid-do-job",
  "status": "success|error",
  "error": "mensagem de erro (se houver)",
  "meta": {
    "pagesProcessed": 5,
    "errors": 0
  },
  "documents": [
    {
      "url": "https://example.com/page1",
      "title": "Page Title",
      "content": "markdown content"
    }
  ]
}
```

## Exemplo de Workflow Completo

### 1. Webhook Trigger
- **Método**: POST
- **Path**: `/crawl`
- **Response Mode**: Response Node

### 2. Set Node (Processar Input)
```javascript
return [{
  json: {
    jobId: $json.jobId,
    url: $json.source.url,
    scope: $json.source.scope,
    depth: $json.source.depth
  }
}];
```

### 3. Crawler Node (Firecrawl/Puppeteer)
- Use o Firecrawl node ou Puppeteer para fazer o crawl
- Configure baseado no scope e depth recebidos

### 4. Processamento dos Dados
```javascript
const documents = [];

for (const page of $json.data) {
  documents.push({
    url: page.metadata?.sourceURL || page.url,
    title: page.metadata?.title || 'Untitled',
    content: page.markdown || page.content
  });
}

return [{
  json: {
    jobId: $('Set').first().json.jobId,
    status: 'success',
    meta: {
      pagesProcessed: documents.length,
      errors: 0
    },
    documents: documents
  }
}];
```

### 5. Respond to Webhook
- **Response Mode**: Last Node
- **Response Code**: 200
- **Response Body**: `={{ $json }}`

## Configuração de Variáveis de Ambiente

No n8n, configure as seguintes variáveis:

```env
FIRECRAWL_API_KEY=your_firecrawl_api_key
KNOWLEDGE_BASE_WEBHOOK_URL=https://your-knowledge-base.com/api/webhooks/n8n
```

## Tratamento de Erros

### Erro de Crawl
```json
{
  "jobId": "uuid-do-job",
  "status": "error",
  "error": "Failed to crawl website: timeout",
  "meta": {
    "pagesProcessed": 0,
    "errors": 1
  }
}
```

### Erro de Validação
```json
{
  "jobId": "uuid-do-job",
  "status": "error",
  "error": "Invalid URL format",
  "meta": {
    "pagesProcessed": 0,
    "errors": 1
  }
}
```

## Testando o Webhook

### 1. Teste Manual
```bash
curl -X POST https://your-n8n-instance.com/webhook/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "test-job-id",
    "source": {
      "url": "https://example.com",
      "scope": "single",
      "depth": 1
    }
  }'
```

### 2. Teste via Knowledge Base
1. Acesse a interface administrativa
2. Adicione uma fonte
3. Selecione modo "n8n"
4. Inicie o crawl
5. Monitore o status do job

## Monitoramento

### Logs do n8n
- Verifique os logs de execução no n8n
- Monitore falhas de webhook
- Acompanhe performance do crawl

### Logs do Knowledge Base
- Verifique logs da aplicação
- Monitore status dos jobs no banco
- Acompanhe erros de integração

## Troubleshooting

### Webhook não recebe dados
1. Verifique se a URL do webhook está correta
2. Confirme se o n8n está rodando
3. Teste o webhook manualmente

### Crawl falha
1. Verifique se a API key do Firecrawl está correta
2. Confirme se o site permite crawling
3. Verifique logs de erro no n8n

### Resposta não chega ao Knowledge Base
1. Verifique se o webhook de resposta está configurado
2. Confirme se a URL de callback está correta
3. Teste a conectividade entre n8n e Knowledge Base
