import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireLocation } from '@/lib/authz';
import { CreateAgentRequest } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    // Scope strictly to the session's location; ignore any client-supplied id.
    const auth = await requireLocation(request);
    if (auth instanceof NextResponse) return auth;

    const query = supabase
      .from('agents')
      .select(`
        *,
        location:locations(id, name, slug)
      `)
      .eq('location_id', auth.locationUuid)
      .order('created_at', { ascending: false });

    const { data: agents, error } = await query;

    if (error) {
      console.error('Error fetching agents:', error);
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
    }

    return NextResponse.json(agents);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // The agent is always created in the session's location, regardless of any
    // location_id sent in the body.
    const auth = await requireLocation(request);
    if (auth instanceof NextResponse) return auth;

    const body: CreateAgentRequest = await request.json();
    const { name, description, personality, objective, additional_info, system_prompt, settings = {} } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data: agent, error } = await supabase
      .from('agents')
      .insert([{
        location_id: auth.locationUuid,
        name,
        description,
        personality,
        objective,
        additional_info,
        system_prompt,
        settings
      }])
      .select(`
        *,
        location:locations(id, name, slug)
      `)
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation (location_id, name)
        return NextResponse.json({ error: 'Agent with this name already exists in this location' }, { status: 409 });
      }
      console.error('Error creating agent:', error);
      return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
    }

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
