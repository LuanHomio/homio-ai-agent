import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { DifyRetrievalRequest, DifyRetrievalResponse } from '@/lib/types';
import { generateEmbedding } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.EXTERNAL_KB_API_KEY;
    
    if (!authHeader || !expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    if (token !== expectedKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const body: DifyRetrievalRequest = await request.json();
    
    // Validate required fields
    if (!body.query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const topK = body.top_k || 5;

    // Tentar busca vetorial primeiro (mais precisa)
    let items: any[] = [];
    let useVectorSearch = true;

    try {
      // Gerar embedding da query
      const queryEmbedding = await generateEmbedding(body.query);
      
      // Buscar usando similaridade vetorial
      const { data: vectorItems, error: vectorError } = await supabase
        .rpc('search_knowledge_items', {
          query_embedding: queryEmbedding,
          kb_ids: body.filters?.knowledge_base_ids || null,
          content_types: ['chunk', 'faq'],
          top_k: topK,
          similarity_threshold: 0.7
        });

      if (!vectorError && vectorItems && vectorItems.length > 0) {
        items = vectorItems;
        console.log(`✅ Busca vetorial encontrou ${items.length} itens para Dify`);
        useVectorSearch = true;
      } else {
        console.log('⚠️ Busca vetorial não retornou resultados, usando fallback textual');
        useVectorSearch = false;
      }
    } catch (embeddingError) {
      console.error('Erro ao gerar embedding ou buscar vetorial:', embeddingError);
      useVectorSearch = false;
    }

    // Fallback para busca textual se vetorial falhar
    if (!useVectorSearch || items.length === 0) {
      console.log('🔄 Usando busca textual como fallback para Dify...');
      const { data: textItems, error: textError } = await supabase
        .rpc('search_knowledge_items_text', {
          query_text: body.query,
          kb_ids: body.filters?.knowledge_base_ids || null,
          content_types: ['chunk', 'faq'],
          top_k: topK
        });

      if (textError) {
        console.error('Database error:', textError);
        
        // Fallback final: busca simples
        const { data: fallbackItems } = await supabase
          .from('knowledge_items')
          .select('id, content, title, url, token_count, created_at, metadata, content_type')
          .in('content_type', ['chunk', 'faq'])
          .limit(topK)
          .order('created_at', { ascending: false });

        const response: DifyRetrievalResponse = {
          chunks: fallbackItems?.map(item => ({
            content: item.content,
            score: 0.7,
            metadata: {
              item_id: item.id,
              content_type: item.content_type || 'chunk',
              document_url: item.url || '',
              document_title: item.title || '',
              token_count: item.token_count || 0,
              created_at: item.created_at,
              ...(item.metadata || {})
            }
          })) || []
        };

        return NextResponse.json(response);
      }

      items = textItems?.map(item => ({
        ...item,
        similarity: 0.6
      })) || [];
    }

    // Ordenar por similaridade e formatar resposta para Dify
    const sortedItems = items.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    const response: DifyRetrievalResponse = {
      chunks: sortedItems.slice(0, topK).map(item => ({
        content: item.content,
        score: item.similarity || 0.8,
        metadata: {
          item_id: item.id,
          content_type: item.content_type,
          document_url: item.url || '',
          document_title: item.title || '',
          token_count: item.token_count || 0,
          created_at: item.created_at,
          ...(item.metadata || {})
        }
      }))
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

