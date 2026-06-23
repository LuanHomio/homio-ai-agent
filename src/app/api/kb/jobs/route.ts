import { NextRequest, NextResponse } from 'next/server';
import { supabase, pageAll } from '@/lib/supabase';
import { requireSource, requireLocation, sourceIdsForLocation } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const sourceId = searchParams.get('sourceId');

    // Scope to the session location: a specific source must belong to it; an
    // unfiltered list is restricted to the location's own sources.
    let allowedSourceIds: string[] | null = null;
    if (sourceId) {
      const auth = await requireSource(request, sourceId);
      if (auth instanceof NextResponse) return auth;
    } else {
      const auth = await requireLocation(request);
      if (auth instanceof NextResponse) return auth;
      allowedSourceIds = await sourceIdsForLocation(auth.locationUuid);
      if (allowedSourceIds.length === 0) return NextResponse.json([]);
    }

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
      } else if (allowedSourceIds) {
        query = query.in('source_id', allowedSourceIds);
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
