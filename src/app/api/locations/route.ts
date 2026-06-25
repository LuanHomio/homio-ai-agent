import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { CreateLocationRequest, UpdateLocationRequest } from '@/lib/types';
import { requireLocation, unauthorized } from '@/lib/authz';
import { getSessionFromRequest } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    // Scope to the caller's own location — this endpoint used to leak EVERY
    // tenant's locations. Returns an array (shape preserved) with just theirs.
    const auth = await requireLocation(request);
    if (auth instanceof NextResponse) {
      // Authenticated but unregistered → no locations yet, not an error.
      if (auth.status === 403) return NextResponse.json([]);
      return auth;
    }

    const { data: location, error } = await supabase
      .from('locations')
      .select('*')
      .eq('id', auth.locationUuid)
      .maybeSingle();

    if (error) {
      console.error('Error fetching locations:', error);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    return NextResponse.json(location ? [location] : []);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorized();

    const body: CreateLocationRequest = await request.json();
    const { name, description, slug, settings = {} } = body;
    // Never trust a client-supplied ghl_location_id: a location can only be
    // created for the caller's own session location.
    const ghl_location_id = session.loc;

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
