import { NextRequest, NextResponse } from 'next/server';
import { supabaseTyped } from '@/lib/supabase';
import { requireAgent } from '@/lib/authz';

export async function GET(request: NextRequest, { params }: { params: { id: string; jobId: string } }) {
  try {
    const auth = await requireAgent(request, params.id);
    if (auth instanceof NextResponse) return auth;

    const { data, error } = await supabaseTyped
      .from('inbound_jobs')
      .select('*')
      .eq('agent_id', params.id)
      .eq('id', params.jobId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error in job detail route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
