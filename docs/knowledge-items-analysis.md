# Análise da Knowledge Base - Knowledge Items

## 📊 Resumo dos Dados Extraídos

### Estatísticas Gerais
- **Total de itens**: 102
  - **Documentos**: 10 (páginas completas)
  - **Chunks**: 92 (pedaços dos documentos)
- **URLs únicas**: 10 páginas da documentação
- **Total de tokens**: ~34.760 tokens
  - Documentos: ~17.035 tokens
  - Chunks: ~17.725 tokens

### Distribuição de Tokens

#### Documentos
- **Média**: 1.703 tokens/documento
- **Mínimo**: 355 tokens
- **Máximo**: 2.675 tokens
- **Tamanho médio**: ~6.000 caracteres/documento

#### Chunks
- **Média**: 193 tokens/chunk
- **Mínimo**: 4 tokens
- **Máximo**: 251 tokens
- **Tamanho médio**: ~769 caracteres/chunk
- **Mediana**: ~879 caracteres/chunk

### Distribuição de Chunks por Documento
- **Média**: ~9 chunks por documento
- **Mínimo**: 2 chunks
- **Máximo**: 15 chunks
- **Tokens médios por chunk**: ~193 tokens

## 🔍 Estrutura dos Chunks

### Configuração Atual
```typescript
chunkSize: 1000 caracteres
overlap: 200 caracteres
```

### Características dos Chunks
1. **Tamanho**: Aproximadamente 770-880 caracteres em média
2. **Overlap**: 200 caracteres entre chunks consecutivos
3. **Estratégia**: 
   - Divide por parágrafos primeiro
   - Se parágrafo > 1000 chars, divide por sentenças
   - Mantém contexto com overlap

### Relações
- Cada chunk tem `metadata->>'document_id'` apontando para o documento original
- Cada chunk tem `metadata->>'position'` indicando ordem no documento
- `source_entity_id` e `source_entity_type` para rastreabilidade

## 🗄️ Estrutura do Banco de Dados

### Tabela `knowledge_items`
```sql
- id (UUID, PK)
- knowledge_base_id (UUID, FK)
- content_type (VARCHAR) -- 'chunk', 'faq', 'document'
- content (TEXT)
- embedding (vector(1536)) -- Para busca vetorial
- metadata (JSONB) -- Hash, source_id, document_id, position, etc.
- source_entity_id (UUID) -- Referência ao documento original
- source_entity_type (VARCHAR)
- title (TEXT)
- url (TEXT)
- token_count (INTEGER)
- created_at, updated_at (TIMESTAMP)
```

### Índices Criados

1. **Índices B-Tree** (busca rápida):
   - `idx_knowledge_items_kb_id` - Filtro por knowledge base
   - `idx_knowledge_items_content_type` - Filtro por tipo
   - `idx_knowledge_items_source_entity` - Busca por entidade origem
   - `idx_knowledge_items_created_at` - Ordenação por data

2. **Índice GIN** (busca em JSONB):
   - `idx_knowledge_items_metadata` - Busca em campos JSONB

3. **Índice Vetorial** (busca semântica):
   - `idx_knowledge_items_embedding` - IVFFlat para similaridade vetorial
   - **Tipo**: IVFFlat com `lists=100`
   - **Operador**: `vector_cosine_ops` (similaridade de cosseno)
   - **Dimensão**: 1536 (OpenAI ada-002)

## 🔎 Funções de Busca

### 1. `search_knowledge_items` (Busca Vetorial)
```sql
-- Busca por similaridade vetorial usando embeddings
SELECT * FROM search_knowledge_items(
  query_embedding,      -- Vector(1536) da query
  kb_ids,              -- Array de knowledge base IDs (opcional)
  content_types,        -- Array de tipos ['chunk', 'faq'] (opcional)
  top_k,               -- Número de resultados (default: 10)
  similarity_threshold  -- Threshold mínimo (default: 0.0)
)
```

**Características**:
- Retorna `similarity` score (0-1, onde 1 = mais similar)
- Ordena por similaridade (maior primeiro)
- Filtra apenas itens com embeddings
- Usa operador `<=>` (distância de cosseno)

### 2. `search_knowledge_items_text` (Busca Textual - Fallback)
```sql
-- Busca por texto usando ILIKE (case-insensitive)
SELECT * FROM search_knowledge_items_text(
  query_text,          -- Texto da busca
  kb_ids,             -- Array de knowledge base IDs (opcional)
  content_types,      -- Array de tipos (opcional)
  top_k              -- Número de resultados (default: 10)
)
```

**Características**:
- Busca em `content`, `title` e `metadata`
- Case-insensitive (ILIKE)
- Ordena por `created_at DESC` (mais recentes primeiro)
- Não requer embeddings

## ⚠️ Problema Identificado: Embeddings Ausentes

**Status Atual**:
- **Total de itens**: 102
- **Com embeddings**: 0 ❌
- **Sem embeddings**: 102 ❌

**Impacto**:
- A busca vetorial (`search_knowledge_items`) **não funcionará** porque todos os embeddings são NULL
- O sistema está usando apenas busca textual (`search_knowledge_items_text`) como fallback
- A busca textual é menos precisa que a busca vetorial

## ✅ Pontos Positivos

1. **Estrutura bem organizada**:
   - Separação clara entre documentos e chunks
   - Metadados completos para rastreabilidade
   - Relações bem definidas

2. **Tamanho de chunks adequado**:
   - ~193 tokens/chunk está dentro do ideal (150-300 tokens)
   - Não muito pequeno (perde contexto)
   - Não muito grande (dificulta busca precisa)

3. **Overlap implementado**:
   - 200 caracteres de overlap mantém contexto entre chunks
   - Evita perder informações nas bordas

4. **Índices otimizados**:
   - Índices B-Tree para filtros comuns
   - Índice GIN para busca em JSONB
   - Índice vetorial preparado (quando embeddings existirem)

5. **Funções de busca bem estruturadas**:
   - Busca vetorial para precisão semântica
   - Busca textual como fallback
   - Filtros flexíveis por KB e tipo

## ⚠️ Pontos de Atenção

1. **Embeddings ausentes** (CRÍTICO):
   - Sem embeddings, a busca vetorial não funciona
   - Necessário implementar geração de embeddings
   - Sugestão: Usar OpenAI ada-002 ou similar

2. **Tamanho de chunks variável**:
   - Alguns chunks muito pequenos (4 tokens)
   - Alguns chunks no limite (251 tokens)
   - Considerar normalizar tamanho mínimo

3. **Busca textual limitada**:
   - ILIKE não é ideal para busca semântica
   - Não entende sinônimos ou contexto
   - Depende de palavras exatas na query

4. **Índice vetorial**:
   - IVFFlat é bom para datasets médios
   - Para < 1000 itens, HNSW pode ser melhor
   - Considerar rebuild após inserir embeddings

## 🎯 Recomendações para o Agente

### 1. Implementar Geração de Embeddings (URGENTE)
```typescript
// Após criar chunks, gerar embeddings
for (const chunk of chunks) {
  const embedding = await generateEmbedding(chunk.content);
  // Atualizar knowledge_item com embedding
}
```

### 2. Usar Busca Híbrida
- **Primário**: Busca vetorial (quando embeddings disponíveis)
- **Fallback**: Busca textual (quando embeddings ausentes)
- **Combinação**: Pode combinar ambos para melhor precisão

### 3. Ajustar Tamanho de Chunks
- **Mínimo**: 50 tokens (filtrar chunks muito pequenos)
- **Ideal**: 150-250 tokens
- **Máximo**: 300 tokens

### 4. Melhorar Busca Textual
- Considerar usar `tsvector` e `tsquery` (PostgreSQL full-text search)
- Mais eficiente que ILIKE para buscas complexas
- Suporta ranking por relevância

### 5. Monitorar Performance
- Verificar tempo de resposta das buscas
- Monitorar uso de tokens
- Ajustar `top_k` baseado em resultados

## 📈 Como Funcionaria a Busca Vetorial (quando implementada)

1. **Query do usuário**: "Como configurar WhatsApp?"
2. **Geração de embedding**: Query → Vector(1536)
3. **Busca vetorial**: Compara embedding da query com embeddings dos chunks
4. **Ranking**: Ordena por similaridade (cosseno)
5. **Filtros**: Aplica filtros de KB e tipo
6. **Retorno**: Top K chunks mais relevantes

**Vantagens**:
- Entende sinônimos ("WhatsApp" = "Whats App")
- Entende contexto ("configurar" = "setup" = "conectar")
- Não depende de palavras exatas
- Ranking por relevância semântica

## 🔧 Próximos Passos

1. ✅ Estrutura criada e funcionando
2. ✅ Chunks gerados corretamente
3. ⚠️ **Implementar geração de embeddings**
4. ⚠️ **Testar busca vetorial**
5. ⚠️ **Otimizar tamanho de chunks**
6. ⚠️ **Implementar busca híbrida**

## 📝 Conclusão

A estrutura está **bem projetada** e **adequada para o agente**, mas **não está completa** porque:

- ✅ Dados extraídos e organizados corretamente
- ✅ Chunks em tamanho adequado
- ✅ Índices otimizados
- ✅ Funções de busca implementadas
- ❌ **Embeddings ausentes** (bloqueador principal)
- ⚠️ Busca textual funcionando, mas limitada

**Recomendação**: Implementar geração de embeddings para habilitar busca vetorial e melhorar significativamente a qualidade das respostas do agente.

