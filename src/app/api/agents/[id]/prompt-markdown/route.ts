import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { promptToMarkdown } from '@/lib/prompt-formatter';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const includeMetadata = searchParams.get('includeMetadata') === 'true';
    const formatLists = searchParams.get('formatLists') !== 'false';

    const { data: agent, error } = await supabase
      .from('agents')
      .select(`
        *,
        location:locations(id, name, slug)
      `)
      .eq('id', params.id)
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const markdown = promptToMarkdown(agent, {
      includeHeader: true,
      includeMetadata,
      formatLists,
      separator: '\n\n---\n\n'
    });

    return NextResponse.json({
      markdown,
      agent: {
        id: agent.id,
        name: agent.name
      }
    });
  } catch (error) {
    console.error('Error generating markdown:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

