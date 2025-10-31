import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: location, error } = await supabase
      .from('locations')
      .select('*')
      .eq('ghl_location_id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
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