import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { UpdateAgentKnowledgeBasesRequest } from '@/lib/types';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: agentKnowledgeBases, error } = await supabase
      .from('agent_knowledge_bases')
      .select(`
        *,
        knowledge_base:knowledge_bases(
          id,
          name,
          description,
          type,
          is_active
        )
      `)
      .eq('agent_id', params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching agent knowledge bases:', error);
      return NextResponse.json({ error: 'Failed to fetch agent knowledge bases' }, { status: 500 });
    }

    return NextResponse.json(agentKnowledgeBases);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body: UpdateAgentKnowledgeBasesRequest = await request.json();
    const { knowledge_base_ids } = body;

    if (!Array.isArray(knowledge_base_ids)) {
      return NextResponse.json({ error: 'knowledge_base_ids must be an array' }, { status: 400 });
    }

    // Verify agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, location_id')
      .eq('id', params.id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Verify all knowledge bases exist and belong to the same location
    if (knowledge_base_ids.length > 0) {
      const { data: knowledgeBases, error: kbError } = await supabase
        .from('knowledge_bases')
        .select('id, location_id')
        .in('id', knowledge_base_ids);

      if (kbError) {
        console.error('Error verifying knowledge bases:', kbError);
        return NextResponse.json({ error: 'Failed to verify knowledge bases' }, { status: 500 });
      }

      if (knowledgeBases.length !== knowledge_base_ids.length) {
        return NextResponse.json({ error: 'One or more knowledge bases not found' }, { status: 404 });
      }

      // Check if all knowledge bases belong to the same location as the agent
      const agentLocationId = agent.location_id;
      console.log('Agent location ID:', agentLocationId);
      console.log('Knowledge bases locations:', knowledgeBases.map(kb => ({ id: kb.id, location_id: kb.location_id })));
      
      const invalidKBs = knowledgeBases.filter(kb => kb.location_id !== agentLocationId);
      if (invalidKBs.length > 0) {
        console.log('Invalid knowledge bases:', invalidKBs);
        return NextResponse.json({ 
          error: 'All knowledge bases must belong to the same location as the agent' 
        }, { status: 400 });
      }
    }

    // Delete existing associations
    const { error: deleteError } = await supabase
      .from('agent_knowledge_bases')
      .delete()
      .eq('agent_id', params.id);

    if (deleteError) {
      console.error('Error deleting existing associations:', deleteError);
      return NextResponse.json({ error: 'Failed to update agent knowledge bases' }, { status: 500 });
    }

    // Create new associations
    if (knowledge_base_ids.length > 0) {
      const associations = knowledge_base_ids.map(kbId => ({
        agent_id: params.id,
        knowledge_base_id: kbId
      }));

      const { error: insertError } = await supabase
        .from('agent_knowledge_bases')
        .insert(associations);

      if (insertError) {
        console.error('Error creating new associations:', insertError);
        return NextResponse.json({ error: 'Failed to update agent knowledge bases' }, { status: 500 });
      }
    }

    // Return updated associations
    const { data: updatedAssociations, error: fetchError } = await supabase
      .from('agent_knowledge_bases')
      .select(`
        *,
        knowledge_base:knowledge_bases(
          id,
          name,
          description,
          type,
          is_active
        )
      `)
      .eq('agent_id', params.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching updated associations:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch updated associations' }, { status: 500 });
    }

    return NextResponse.json(updatedAssociations);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
