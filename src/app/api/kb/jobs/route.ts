import { NextRequest, NextResponse } from 'next/server';
import { supabase, pageAll } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const sourceId = searchParams.get('sourceId');

    const data = await pageAll<any>((from, to) => {
      let query = supabase
        .from('crawl_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (status) {
        const statusList = status.split(',').map(s => s.trim());
        query = query.in('status', statusList);
      }

      if (sourceId) {
        query = query.eq('source_id', sourceId);
      }

      return query;
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
