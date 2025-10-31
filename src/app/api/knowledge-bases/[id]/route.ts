import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { UpdateKnowledgeBaseRequest } from '@/lib/types';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: knowledgeBase, error } = await supabase
      .from('knowledge_bases')
      .select(`
        *,
        location:locations(id, name, slug)
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
      }
      console.error('Error fetching knowledge base:', error);
      return NextResponse.json({ error: 'Failed to fetch knowledge base' }, { status: 500 });
    }

    return NextResponse.json(knowledgeBase);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body: UpdateKnowledgeBaseRequest = await request.json();
    const { name, description, type, settings, is_active } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (settings !== undefined) updateData.settings = settings;
    if (is_active !== undefined) updateData.is_active = is_active;
    updateData.updated_at = new Date().toISOString();

    const { data: knowledgeBase, error } = await supabase
      .from('knowledge_bases')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        location:locations(id, name, slug)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
      }
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'Knowledge base with this name already exists in this location' }, { status: 409 });
      }
      console.error('Error updating knowledge base:', error);
      return NextResponse.json({ error: 'Failed to update knowledge base' }, { status: 500 });
    }

    return NextResponse.json(knowledgeBase);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check if knowledge base has agent associations
    const { data: agentAssociations, error: associationsError } = await supabase
      .from('agent_knowledge_bases')
      .select('id')
      .eq('knowledge_base_id', params.id)
      .limit(1);

    if (associationsError) {
      console.error('Error checking agent associations:', associationsError);
      return NextResponse.json({ error: 'Failed to check knowledge base dependencies' }, { status: 500 });
    }

    if (agentAssociations && agentAssociations.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete knowledge base with agent associations. Remove all agent associations first.' 
      }, { status: 409 });
    }

    const { error } = await supabase
      .from('knowledge_bases')
      .delete()
      .eq('id', params.id);

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
      }
      console.error('Error deleting knowledge base:', error);
      return NextResponse.json({ error: 'Failed to delete knowledge base' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Knowledge base deleted successfully' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
