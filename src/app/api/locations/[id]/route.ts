import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const autoCreate = searchParams.get('auto_create') === 'true';
    const userName = searchParams.get('user_name');

    const { data: location, error } = await supabase
      .from('locations')
      .select('*')
      .eq('ghl_location_id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        // Auto-create location if requested (first access from GHL)
        if (autoCreate) {
          const slug = params.id.toLowerCase().slice(0, 20);
          const { data: newLocation, error: createError } = await supabase
            .from('locations')
            .insert([{
              name: userName || `Location ${params.id.slice(0, 8)}`,
              slug: `ghl-${slug}`,
              ghl_location_id: params.id,
              settings: {},
              is_active: true
            }])
            .select('*')
            .single();

          if (createError) {
            console.error('Error auto-creating location:', createError);
            return NextResponse.json({ error: 'Failed to auto-create location' }, { status: 500 });
          }

          return NextResponse.json(newLocation, { status: 201 });
        }

        return NextResponse.json({ error: 'Location not found' }, { status: 404 });
      }
      console.error('Error fetching location:', error);
      return NextResponse.json({ error: 'Failed to fetch location' }, { status: 500 });
    }

    return NextResponse.json(location);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}