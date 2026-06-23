import { NextRequest, NextResponse } from 'next/server';
import { supabaseTyped } from '@/lib/supabase';
import { requireAgent } from '@/lib/authz';
import { validateCreateAction } from '@/lib/agent-action-schemas';
import type { Json } from '@/lib/database.types';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAgent(request, params.id);
    if (auth instanceof NextResponse) return auth;

    const { data, error } = await supabaseTyped
      .from('agent_actions')
      .select('*')
      .eq('agent_id', params.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching agent actions:', error);
      return NextResponse.json({ error: 'Failed to fetch actions' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAgent(request, params.id);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const result = validateCreateAction(body);
    if (!result.ok) {
      return NextResponse.json(result.error, { status: 400 });
    }

    const { data, error } = await supabaseTyped
      .from('agent_actions')
      .insert([{
        agent_id: params.id,
        action_type: result.value.action_type,
        name: result.value.name,
        description: result.value.description ?? null,
        config: result.value.config as Json,
        is_active: result.value.is_active,
        sort_order: result.value.sort_order,
      }])
      .select('*')
      .single();

    if (error) {
      console.error('Error creating agent action:', error);
      return NextResponse.json({ error: 'Failed to create action' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
