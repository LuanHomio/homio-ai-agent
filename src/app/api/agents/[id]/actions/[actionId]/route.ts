import { NextRequest, NextResponse } from 'next/server';
import { supabaseTyped } from '@/lib/supabase';
import { validateUpdateAction } from '@/lib/agent-action-schemas';
import type { ActionType } from '@/lib/types';

type RouteParams = { params: { id: string; actionId: string } };

async function loadAction(agentId: string, actionId: string) {
  return await supabaseTyped
    .from('agent_actions')
    .select('*')
    .eq('agent_id', agentId)
    .eq('id', actionId)
    .single();
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { data, error } = await loadAction(params.id, params.actionId);

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Action not found' }, { status: 404 });
      }
      console.error('Error fetching agent action:', error);
      return NextResponse.json({ error: 'Failed to fetch action' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { data: existing, error: loadError } = await loadAction(params.id, params.actionId);
    if (loadError || !existing) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    const body = await request.json();
    const result = validateUpdateAction(body, existing.action_type as ActionType);
    if (!result.ok) {
      return NextResponse.json(result.error, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (result.value.name !== undefined) updateData.name = result.value.name;
    if (result.value.description !== undefined) updateData.description = result.value.description;
    if (result.value.config !== undefined) updateData.config = result.value.config;
    if (result.value.is_active !== undefined) updateData.is_active = result.value.is_active;
    if (result.value.sort_order !== undefined) updateData.sort_order = result.value.sort_order;

    const { data, error } = await supabaseTyped
      .from('agent_actions')
      .update(updateData)
      .eq('agent_id', params.id)
      .eq('id', params.actionId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating agent action:', error);
      return NextResponse.json({ error: 'Failed to update action' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { data: existing, error: loadError } = await loadAction(params.id, params.actionId);
    if (loadError || !existing) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    const { error } = await supabaseTyped
      .from('agent_actions')
      .delete()
      .eq('agent_id', params.id)
      .eq('id', params.actionId);

    if (error) {
      console.error('Error deleting agent action:', error);
      return NextResponse.json({ error: 'Failed to delete action' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Action deleted successfully' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
