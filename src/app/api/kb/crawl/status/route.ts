import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const knowledgeBaseId = searchParams.get('knowledgeBaseId');

    if (!sourceId && !knowledgeBaseId) {
      return NextResponse.json(
        { error: 'sourceId or knowledgeBaseId is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('crawl_jobs')
      .select(`
        id,
        source_id,
        status,
        started_at,
        finished_at,
        error,
        meta,
        created_at,
        source:kb_sources(
          id,
          url,
          scope,
          depth
        )
      `)
      .order('created_at', { ascending: false });

    if (sourceId) {
      query = query.eq('source_id', sourceId);
    } else if (knowledgeBaseId) {
      // Get all sources for this knowledge base
      const { data: sources } = await supabase
        .from('kb_sources')
        .select('id')
        .eq('knowledge_base_id', knowledgeBaseId);

      if (!sources || sources.length === 0) {
        return NextResponse.json([]);
      }

      const sourceIds = sources.map(s => s.id);
      query = query.in('source_id', sourceIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch crawl status' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
