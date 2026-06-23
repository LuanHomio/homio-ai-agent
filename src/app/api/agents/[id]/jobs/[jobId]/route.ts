import { NextRequest, NextResponse } from 'next/server';
import { supabaseTyped } from '@/lib/supabase';

export async function GET(_request: NextRequest, { params }: { params: { id: string; jobId: string } }) {
  try {
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
