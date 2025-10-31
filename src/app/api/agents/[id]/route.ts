import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { UpdateAgentRequest } from '@/lib/types';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: agent, error } = await supabase
      .from('agents')
      .select(`
        *,
        location:locations(id, name, slug)
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }
      console.error('Error fetching agent:', error);
      return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body: UpdateAgentRequest = await request.json();
    const { name, description, personality, objective, additional_info, system_prompt, dify_app_id, settings, is_active } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (personality !== undefined) updateData.personality = personality;
    if (objective !== undefined) updateData.objective = objective;
    if (additional_info !== undefined) updateData.additional_info = additional_info;
    if (system_prompt !== undefined) updateData.system_prompt = system_prompt;
    if (dify_app_id !== undefined) updateData.dify_app_id = dify_app_id;
    if (settings !== undefined) updateData.settings = settings;
    if (is_active !== undefined) updateData.is_active = is_active;
    updateData.updated_at = new Date().toISOString();

    const { data: agent, error } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        location:locations(id, name, slug)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }
      if (error.code === '23505') { // Unique constraint violation (location_id, name)
        return NextResponse.json({ error: 'Agent with this name already exists in this location' }, { status: 409 });
      }
      console.error('Error updating agent:', error);
      return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check if agent has KB sources or FAQs
    const { data: sources, error: sourcesError } = await supabase
      .from('kb_sources')
      .select('id')
      .eq('agent_id', params.id)
      .limit(1);

    if (sourcesError) {
      console.error('Error checking KB sources:', sourcesError);
      return NextResponse.json({ error: 'Failed to check agent dependencies' }, { status: 500 });
    }

    const { data: faqs, error: faqsError } = await supabase
      .from('faqs')
      .select('id')
      .eq('agent_id', params.id)
      .limit(1);

    if (faqsError) {
      console.error('Error checking FAQs:', faqsError);
      return NextResponse.json({ error: 'Failed to check agent dependencies' }, { status: 500 });
    }

    if ((sources && sources.length > 0) || (faqs && faqs.length > 0)) {
      return NextResponse.json({ 
        error: 'Cannot delete agent with existing KB sources or FAQs. Delete all associated data first.' 
      }, { status: 409 });
    }

    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', params.id);

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }
      console.error('Error deleting agent:', error);
      return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
