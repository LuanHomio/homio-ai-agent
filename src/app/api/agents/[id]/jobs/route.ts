import { NextRequest, NextResponse } from 'next/server';
import { supabaseTyped } from '@/lib/supabase';

const ALLOWED_STATUS = new Set(['pending', 'processing', 'completed', 'error', 'skipped']);

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    let query = supabaseTyped
      .from('inbound_jobs')
      .select('id, conversation_id, contact_id, status, message_text, response_text, error_message, processing_time_ms, context_sources, created_at', { count: 'exact' })
      .eq('agent_id', params.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && ALLOWED_STATUS.has(status)) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.ilike('message_text', `%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error('Error fetching agent jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }

    const items = (data ?? []).map((job) => {
      const sources = Array.isArray(job.context_sources) ? (job.context_sources as Array<Record<string, any>>) : [];
      const geminiCalls = sources.filter((s) => s?.source === 'gemini_call');
      const totalTokens = geminiCalls.reduce((acc, s) => acc + (Number(s?.tokens?.total) || 0), 0);
      const toolCount = sources.filter((s) => s?.source === 'agent_action' || s?.source === 'tool_call').length;
      const finishReason = geminiCalls.length > 0 ? (geminiCalls[geminiCalls.length - 1]?.finishReason ?? null) : null;
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
        summary: {
          gemini_calls: geminiCalls.length,
          tool_count: toolCount,
          total_tokens: totalTokens || null,
          final_finish_reason: finishReason,
        },
      };
    });

    return NextResponse.json({ items, total: count ?? items.length, limit, offset });
  } catch (error) {
    console.error('Unexpected error in jobs route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
