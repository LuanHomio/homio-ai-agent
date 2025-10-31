import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { CreateLocationRequest, UpdateLocationRequest } from '@/lib/types';

export async function GET() {
  try {
    const { data: locations, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching locations:', error);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    return NextResponse.json(locations);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateLocationRequest = await request.json();
    const { name, description, slug, ghl_location_id, settings = {} } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Validate slug format (alphanumeric, hyphens, underscores only)
    const slugRegex = /^[a-z0-9-_]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ 
        error: 'Slug must contain only lowercase letters, numbers, hyphens, and underscores' 
      }, { status: 400 });
    }

    const { data: location, error } = await supabase
      .from('locations')
      .insert([{
        name,
        description,
        slug,
        ghl_location_id,
        settings
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'Location with this slug already exists' }, { status: 409 });
      }
      console.error('Error creating location:', error);
      return NextResponse.json({ error: 'Failed to create location' }, { status: 500 });
    }

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
