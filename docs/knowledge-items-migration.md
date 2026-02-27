# Migração para Tabela Unificada de Knowledge Items

## Visão Geral

Esta migração cria uma nova estrutura unificada (`knowledge_items`) que consolida todos os tipos de conteúdo (chunks, FAQs, documentos) em uma única tabela com suporte a busca vetorial.

## Estrutura Criada

### Tabela `knowledge_items`

- **id**: UUID primário
- **knowledge_base_id**: Referência à knowledge base
- **content_type**: Tipo de conteúdo ('chunk', 'faq', 'document')
- **content**: Texto do conteúdo
- **embedding**: Vetor de embeddings (1536 dimensões - OpenAI ada-002)
- **metadata**: JSONB com metadados flexíveis
- **source_entity_id**: ID da entidade original (para rastreabilidade)
- **source_entity_type**: Tipo da entidade original
- **title**: Título (denormalizado)
- **url**: URL (denormalizado)
- **token_count**: Contagem de tokens
- **created_at/updated_at**: Timestamps

### Funções RPC Criadas

1. **search_knowledge_items**: Busca vetorial por similaridade
   - Parâmetros: query_embedding, kb_ids, content_types, top_k, similarity_threshold
   - Retorna: itens ordenados por similaridade

2. **search_knowledge_items_text**: Busca por texto (fallback)
   - Parâmetros: query_text, kb_ids, content_types, top_k
   - Retorna: itens que contêm o texto

## Como Aplicar

### 1. Aplicar a Migration Principal

```sql
-- Execute no Supabase SQL Editor ou via CLI
\i migrations/007_create_unified_knowledge_items.sql
```

Ou copie e cole o conteúdo do arquivo no Supabase SQL Editor.

### 2. Verificar Extensão pgvector

Certifique-se de que a extensão `vector` está habilitada:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. (Opcional) Limpar Tabelas Antigas

**ATENÇÃO**: Isso deletará todos os dados das tabelas antigas!

Apenas execute `008_optional_cleanup_old_tables.sql` se:
- Todos os dados foram migrados para `knowledge_items`
- Você não precisa mais das tabelas antigas
- Você tem backup dos dados

## Vantagens da Nova Estrutura

1. **Busca Unificada**: Uma única query para todos os tipos de conteúdo
2. **Performance**: Índice vetorial único, menos joins
3. **Simplicidade**: Código de busca mais simples
4. **Escalabilidade**: Fácil adicionar novos tipos de conteúdo
5. **Busca Semântica**: Suporte nativo a embeddings

## Próximos Passos

1. ✅ Migration criada
2. ⏳ Aplicar migration no Supabase
3. ⏳ Atualizar código da aplicação para usar `knowledge_items`
4. ⏳ Implementar geração de embeddings
5. ⏳ Migrar dados existentes (se necessário)
6. ⏳ Testar busca vetorial

## Notas Técnicas

- **Dimensão do Embedding**: 1536 (OpenAI ada-002)
  - Se usar outro modelo, ajuste a dimensão na migration
  - Modelos comuns:
    - OpenAI ada-002: 1536
    - OpenAI text-embedding-3-small: 1536
    - OpenAI text-embedding-3-large: 3072
    - Cohere: 1024
    - Sentence Transformers: varia (384, 768, etc.)

- **Índice IVFFlat**: Requer dados para ser eficiente
  - Se a tabela estiver vazia, o índice pode precisar ser reconstruído após inserir dados
  - Para grandes volumes, considere ajustar o parâmetro `lists`

- **RLS**: Row Level Security está habilitado
  - Apenas service_role pode gerenciar knowledge_items
  - Ajuste políticas se necessário para outros roles


