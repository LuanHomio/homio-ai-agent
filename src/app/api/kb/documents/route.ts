import { NextRequest, NextResponse } from 'next/server';
import { supabase, pageAll } from '@/lib/supabase';
import { requireKb, requireAgent, requireLocation, sourceIdsForLocation } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const knowledgeBaseId = searchParams.get('knowledge_base_id');
    const agentId = searchParams.get('agent_id');

    // Scope to the session location: a kb/agent filter must belong to it; an
    // unfiltered list is restricted to the location's own sources.
    let scopeIds: string[] | null = null;
    if (knowledgeBaseId) {
      const auth = await requireKb(request, knowledgeBaseId);
      if (auth instanceof NextResponse) return auth;
    } else if (agentId) {
      const auth = await requireAgent(request, agentId);
      if (auth instanceof NextResponse) return auth;
    } else {
      const auth = await requireLocation(request);
      if (auth instanceof NextResponse) return auth;
      scopeIds = await sourceIdsForLocation(auth.locationUuid);
      if (scopeIds.length === 0) return NextResponse.json({ items: [] });
    }

    const data = await pageAll<any>((from, to) => {
      let query = supabase
        .from('kb_sources')
        .select('id, knowledge_base_id, agent_id, status, metadata, created_at')
        .eq('source_type', 'document')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (knowledgeBaseId) query = query.eq('knowledge_base_id', knowledgeBaseId);
      if (agentId) query = query.eq('agent_id', agentId);
      if (scopeIds) query = query.in('id', scopeIds);

      return query;
    });

    const items = data.map((row: any) => ({
      id: row.id,
      knowledge_base_id: row.knowledge_base_id,
      agent_id: row.agent_id,
      status: row.status,
      filename: row.metadata?.filename ?? null,
      mime: row.metadata?.mime ?? null,
      kind: row.metadata?.kind ?? null,
      size_bytes: row.metadata?.size_bytes ?? null,
      chunk_count: row.metadata?.chunk_count ?? null,
      page_count: row.metadata?.page_count ?? null,
      row_count: row.metadata?.row_count ?? null,
      total_rows_in_source: row.metadata?.total_rows_in_source ?? null,
      truncated: row.metadata?.truncated ?? null,
      error_message: row.metadata?.error_message ?? null,
      created_at: row.created_at,
    }));

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('[kb/documents] internal:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
