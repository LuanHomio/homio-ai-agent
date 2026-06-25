import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { CreateKnowledgeBaseRequest } from '@/lib/types';
import { requireLocation } from '@/lib/authz';

export async function GET(request: NextRequest) {
  try {
    // Always scope to the caller's own location, derived from the signed session
    // (the client-supplied location_id was trusted blindly before).
    const auth = await requireLocation(request);
    if (auth instanceof NextResponse) {
      if (auth.status === 403) return NextResponse.json([]); // unregistered → none yet
      return auth;
    }

    const { data: knowledgeBases, error } = await supabase
      .from('knowledge_bases')
      .select(`
        *,
        location:locations(id, name, slug)
      `)
      .eq('location_id', auth.locationUuid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching knowledge bases:', error);
      return NextResponse.json({ error: 'Failed to fetch knowledge bases' }, { status: 500 });
    }

    return NextResponse.json(knowledgeBases);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireLocation(request);
    if (auth instanceof NextResponse) return auth;

    const body: CreateKnowledgeBaseRequest = await request.json();
    const { name, description, type = 'general', settings = {} } = body;
    // KB is always created under the caller's own location (never a body value).
    const locationUuid = auth.locationUuid;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data: knowledgeBase, error } = await supabase
      .from('knowledge_bases')
      .insert([{
        location_id: locationUuid,
        name,
        description,
        type,
        settings
      }])
      .select(`
        *,
        location:locations(id, name, slug)
      `)
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'Knowledge base with this name already exists in this location' }, { status: 409 });
      }
      console.error('Error creating knowledge base:', error);
      return NextResponse.json({ error: 'Failed to create knowledge base' }, { status: 500 });
    }

    return NextResponse.json(knowledgeBase);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
