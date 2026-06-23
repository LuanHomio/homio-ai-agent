import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireKb } from '@/lib/authz';
import { generateEmbedding } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const batchSize = body.batchSize || 50;
    const limit = body.limit || batchSize;
    const knowledgeBaseId = body.knowledge_base_id || body.knowledgeBaseId;

    if (!knowledgeBaseId) {
      return NextResponse.json({ error: 'knowledge_base_id is required' }, { status: 400 });
    }
    const auth = await requireKb(request, knowledgeBaseId);
    if (auth instanceof NextResponse) return auth;

    const { data: items, error: fetchError } = await supabase
      .from('knowledge_items')
      .select('id, content, content_type, title')
      .eq('knowledge_base_id', knowledgeBaseId)
      .is('embedding', null)
      .limit(limit);

    if (fetchError) {
      console.error('Erro ao buscar itens:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch items', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'Nenhum item pendente de embedding.',
        processed: 0,
        total: 0
      });
    }

    console.log(`🔄 Processando ${items.length} itens sem embedding...`);

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const item of items) {
      try {
        if (!item.content || item.content.trim().length === 0) {
          console.warn(`⚠️ Item ${item.id} tem conteúdo vazio, pulando...`);
          continue;
        }

        const embedding = await generateEmbedding(item.content);
        
        // Supabase aceita array de números diretamente para colunas vector
        const { error: updateError } = await supabase
          .from('knowledge_items')
          .update({ 
            embedding: embedding as any // Type assertion para vector type
          })
          .eq('id', item.id);

        if (updateError) {
          throw updateError;
        }

        successCount++;
        console.log(`✅ Embedding gerado para item ${item.id} (${item.content_type})`);
      } catch (err) {
        errorCount++;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`❌ Erro no item ${item.id}:`, errorMessage);
        errors.push({ id: item.id, error: errorMessage });
      }
    }

    return NextResponse.json({ 
      success: true,
      processed: successCount,
      errors: errorCount,
      total: items.length,
      errorDetails: errors.length > 0 ? errors : undefined,
      message: successCount < items.length 
        ? `Processados ${successCount} de ${items.length}. Rode novamente se houver mais itens.`
        : `Todos os ${successCount} itens foram processados com sucesso.`
    });
  } catch (error) {
    console.error('Erro ao processar embeddings:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const knowledgeBaseId = searchParams.get('knowledge_base_id') || searchParams.get('knowledgeBaseId');

    if (!knowledgeBaseId) {
      return NextResponse.json({ error: 'knowledge_base_id is required' }, { status: 400 });
    }
    const auth = await requireKb(request, knowledgeBaseId);
    if (auth instanceof NextResponse) return auth;

    const { data: items, error, count } = await supabase
      .from('knowledge_items')
      .select('id, content_type, title, url', { count: 'exact' })
      .eq('knowledge_base_id', knowledgeBaseId)
      .is('embedding', null)
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch items', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      pending: count || 0,
      items: items || [],
      message: count === 0 
        ? 'Todos os itens já possuem embeddings.'
        : `Existem ${count} itens pendentes de embedding.`
    });
  } catch (error) {
    console.error('Erro ao verificar embeddings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

