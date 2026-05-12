import { NextRequest, NextResponse } from 'next/server';
import { supabaseTyped } from '@/lib/supabase';

const ALLOWED_STATUS = new Set(['pending', 'processing', 'completed', 'error', 'skipped']);
const ALLOWED_SEARCH_FIELDS = new Set(['message', 'response', 'both']);
const AGGREGATE_LIMIT = 1000;

type JobSource = Record<string, any>;

function summarizeSources(sources: JobSource[]) {
  const geminiCalls = sources.filter((s) => s?.source === 'gemini_call');
  const totalTokens = geminiCalls.reduce((acc, s) => acc + (Number(s?.tokens?.total) || 0), 0);
  const toolNames = new Set<string>();
  let toolCount = 0;
  for (const s of sources) {
    if (s?.source === 'agent_action' || s?.source === 'tool_call') {
      toolCount += 1;
      if (typeof s?.name === 'string' && s.name) toolNames.add(s.name);
    }
  }
  const finishReason = geminiCalls.length > 0 ? (geminiCalls[geminiCalls.length - 1]?.finishReason ?? null) : null;
  return {
    gemini_calls: geminiCalls.length,
    tool_count: toolCount,
    total_tokens: totalTokens || null,
    final_finish_reason: finishReason,
    tool_names: Array.from(toolNames),
  };
}

type Filters = {
  agentId: string;
  status: string | null;
  search: string | null;
  searchField: 'message' | 'response' | 'both';
  toolName: string | null;
  from: string | null;
  to: string | null;
  minLatency: number | null;
  maxLatency: number | null;
};

function applyFilters(query: any, f: Filters) {
  let q = query.eq('agent_id', f.agentId);
  if (f.status && ALLOWED_STATUS.has(f.status)) q = q.eq('status', f.status);
  if (f.search) {
    if (f.searchField === 'response') {
      q = q.ilike('response_text', `%${f.search}%`);
    } else if (f.searchField === 'both') {
      const esc = f.search.replace(/,/g, '\\,').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      q = q.or(`message_text.ilike.%${esc}%,response_text.ilike.%${esc}%`);
    } else {
      q = q.ilike('message_text', `%${f.search}%`);
    }
  }
  if (f.from) q = q.gte('created_at', f.from);
  if (f.to) q = q.lte('created_at', f.to);
  if (f.minLatency != null) q = q.gte('processing_time_ms', f.minLatency);
  if (f.maxLatency != null) q = q.lte('processing_time_ms', f.maxLatency);
  if (f.toolName) {
    q = q.filter('context_sources', 'cs', JSON.stringify([{ name: f.toolName }]));
  }
  return q;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim() || null;
    const searchFieldRaw = searchParams.get('search_field') ?? 'message';
    const searchField = (ALLOWED_SEARCH_FIELDS.has(searchFieldRaw) ? searchFieldRaw : 'message') as Filters['searchField'];
    const toolName = searchParams.get('tool_name')?.trim() || null;
    const from = searchParams.get('from')?.trim() || null;
    const to = searchParams.get('to')?.trim() || null;
    const minLatencyRaw = searchParams.get('min_latency_ms');
    const maxLatencyRaw = searchParams.get('max_latency_ms');
    const minLatency = minLatencyRaw && Number.isFinite(Number(minLatencyRaw)) ? Number(minLatencyRaw) : null;
    const maxLatency = maxLatencyRaw && Number.isFinite(Number(maxLatencyRaw)) ? Number(maxLatencyRaw) : null;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    const filters: Filters = {
      agentId: params.id,
      status,
      search,
      searchField,
      toolName,
      from,
      to,
      minLatency,
      maxLatency,
    };

    const listBase = supabaseTyped
      .from('inbound_jobs')
      .select(
        'id, conversation_id, contact_id, status, message_text, response_text, error_message, processing_time_ms, context_sources, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    const listQuery = applyFilters(listBase, filters);

    const aggBase = supabaseTyped
      .from('inbound_jobs')
      .select('processing_time_ms, context_sources')
      .order('created_at', { ascending: false })
      .limit(AGGREGATE_LIMIT);
    const aggQuery = applyFilters(aggBase, filters);

    const [listRes, aggRes] = await Promise.all([listQuery, aggQuery]);

    if (listRes.error) {
      console.error('Error fetching agent jobs:', listRes.error);
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }

    const items = (listRes.data ?? []).map((job: any) => {
      const sources = Array.isArray(job.context_sources) ? (job.context_sources as JobSource[]) : [];
      const summary = summarizeSources(sources);
      return {
        id: job.id,
        conversation_id: job.conversation_id,
        contact_id: job.contact_id,
        status: job.status,
        message_text: job.message_text,
        response_text: job.response_text,
        error_message: job.error_message,
        processing_time_ms: job.processing_time_ms,
        created_at: job.created_at,
        summary,
      };
    });

    let totals = {
      total_jobs: listRes.count ?? items.length,
      total_tokens: 0,
      total_latency_ms: 0,
      avg_latency_ms: null as number | null,
      sample_capped: false,
    };
    const toolNamesSet = new Set<string>();
    if (!aggRes.error && Array.isArray(aggRes.data)) {
      let latencySum = 0;
      let latencyCount = 0;
      let tokenSum = 0;
      for (const row of aggRes.data as any[]) {
        const sources = Array.isArray(row.context_sources) ? (row.context_sources as JobSource[]) : [];
        for (const s of sources) {
          if (s?.source === 'gemini_call') {
            const t = Number(s?.tokens?.total);
            if (Number.isFinite(t)) tokenSum += t;
          }
          if ((s?.source === 'agent_action' || s?.source === 'tool_call') && typeof s?.name === 'string' && s.name) {
            toolNamesSet.add(s.name);
          }
        }
        if (typeof row.processing_time_ms === 'number' && Number.isFinite(row.processing_time_ms)) {
          latencySum += row.processing_time_ms;
          latencyCount += 1;
        }
      }
      totals = {
        total_jobs: listRes.count ?? aggRes.data.length,
        total_tokens: tokenSum,
        total_latency_ms: latencySum,
        avg_latency_ms: latencyCount > 0 ? Math.round(latencySum / latencyCount) : null,
        sample_capped: aggRes.data.length >= AGGREGATE_LIMIT,
      };
    } else if (aggRes.error) {
      console.error('Error aggregating agent jobs:', aggRes.error);
    }

    return NextResponse.json({
      items,
      total: listRes.count ?? items.length,
      limit,
      offset,
      totals,
      tool_names: Array.from(toolNamesSet).sort(),
    });
  } catch (error) {
    console.error('Unexpected error in jobs route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
