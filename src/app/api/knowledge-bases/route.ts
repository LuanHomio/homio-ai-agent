import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { CreateKnowledgeBaseRequest } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('location_id');

    let query = supabase
      .from('knowledge_bases')
      .select(`
        *,
        location:locations(id, name, slug)
      `)
      .order('created_at', { ascending: false });

    if (locationId) {
      // First get the location by ghl_location_id to get the internal UUID
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .select('id')
        .eq('ghl_location_id', locationId)
        .single();

      if (locationError || !location) {
        return NextResponse.json({ error: 'Location not found' }, { status: 404 });
      }

      query = query.eq('location_id', location.id);
    }

    const { data: knowledgeBases, error } = await query;

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
    const body: CreateKnowledgeBaseRequest = await request.json();
    const { location_id, name, description, type = 'general', settings = {} } = body;

    if (!location_id || !name) {
      return NextResponse.json({ error: 'Location ID and name are required' }, { status: 400 });
    }

    // Verify location exists by ghl_location_id
    const { data: location, error: locationError } = await supabase
      .from('locations')
      .select('id')
      .eq('ghl_location_id', location_id)
      .single();

    if (locationError || !location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const { data: knowledgeBase, error } = await supabase
      .from('knowledge_bases')
      .insert([{
        location_id: location.id,
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
