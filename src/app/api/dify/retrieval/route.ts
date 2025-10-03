import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { DifyRetrievalRequest, DifyRetrievalResponse } from '@/lib/types';

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

    // For now, we'll do a simple text search since embeddings aren't generated yet
    // TODO: Implement vector similarity search when embeddings are available
    
    const { data: chunks, error } = await supabase
      .from('chunks')
      .select(`
        id,
        content,
        token_count,
        created_at,
        documents!inner (
          id,
          url,
          title,
          source_id,
          kb_sources!inner (
            url,
            scope
          )
        )
      `)
      .textSearch('content', body.query, {
        type: 'websearch',
        config: 'english'
      })
      .limit(topK);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to search knowledge base' },
        { status: 500 }
      );
    }

    // Format response for Dify
    const response: DifyRetrievalResponse = {
      chunks: chunks?.map(chunk => ({
        content: chunk.content,
        score: 0.8, // Placeholder score since we're not using vector similarity yet
        metadata: {
          chunk_id: chunk.id,
          document_id: chunk.documents.id,
          document_url: chunk.documents.url,
          document_title: chunk.documents.title,
          source_url: chunk.documents.kb_sources.url,
          source_scope: chunk.documents.kb_sources.scope,
          token_count: chunk.token_count,
          created_at: chunk.created_at
        }
      })) || []
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

