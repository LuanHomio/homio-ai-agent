import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { CreateSourceRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: CreateSourceRequest = await request.json();
    
    // Validate required fields
    if (!body.url || !body.scope || typeof body.depth !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: url, scope, depth' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Validate scope
    if (!['domain', 'path', 'single'].includes(body.scope)) {
      return NextResponse.json(
        { error: 'Invalid scope. Must be: domain, path, or single' },
        { status: 400 }
      );
    }

    // Validate depth
    if (body.depth < 1 || body.depth > 10) {
      return NextResponse.json(
        { error: 'Depth must be between 1 and 10' },
        { status: 400 }
      );
    }

    // Insert source
    const { data, error } = await supabase
      .from('kb_sources')
      .insert([{
        url: body.url,
        scope: body.scope,
        depth: body.depth,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create source' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('kb_sources')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sources' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

