import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');

    let query = supabase
      .from('knowledge_items')
      .select('id, url, title, created_at, metadata')
      .eq('content_type', 'document')
      .order('created_at', { ascending: false });

    if (sourceId) {
      query = query.eq('metadata->>source_id', sourceId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    const documents = data?.map(item => ({
      id: item.id,
      source_id: item.metadata?.source_id || null,
      url: item.url,
      title: item.title,
      created_at: item.created_at
    })) || [];

    return NextResponse.json(documents);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
