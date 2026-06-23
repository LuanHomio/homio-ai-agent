import { NextRequest, NextResponse } from 'next/server';
import { supabase, pageAll } from '@/lib/supabase';
import { requireKb, requireAgent, requireLocation, requireSource, sourceIdsForLocation } from '@/lib/authz';
import { CreateSourceRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: CreateSourceRequest = await request.json();
    
    // Validate required fields
    if (!body.url || !body.scope || typeof body.depth !== 'number' || !body.knowledge_base_id) {
      return NextResponse.json(
        { error: 'Missing required fields: url, scope, depth, knowledge_base_id' },
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

    const auth = await requireKb(request, body.knowledge_base_id);
    if (auth instanceof NextResponse) return auth;

    // Verify knowledge base exists
    const { data: kb, error: kbError } = await supabase
      .from('knowledge_bases')
      .select('id, location_id')
      .eq('id', body.knowledge_base_id)
      .single();

    if (kbError || !kb) {
      return NextResponse.json(
        { error: 'Knowledge base not found' },
        { status: 404 }
      );
    }

    // Buscar agent_id da knowledge_base se não fornecido
    let agentId = body.agent_id;
    if (!agentId) {
      const { data: agentData } = await supabase
        .from('agent_knowledge_bases')
        .select('agent_id')
        .eq('knowledge_base_id', body.knowledge_base_id)
        .limit(1)
        .single();
      
      agentId = agentData?.agent_id || null;
    }

    // Insert source
    const { data, error } = await supabase
      .from('kb_sources')
      .insert([{
        url: body.url,
        scope: body.scope,
        depth: body.depth,
        knowledge_base_id: body.knowledge_base_id,
        agent_id: agentId, // Pode ser null
        is_active: true
      }])
      .select(`
        *,
        knowledge_base:knowledge_bases(id, name, location:locations(name))
      `)
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const knowledgeBaseId = searchParams.get('knowledge_base_id');

    // Scope to the session location.
    let scopeIds: string[] | null = null;
    if (knowledgeBaseId) {
      const auth = await requireKb(request, knowledgeBaseId);
      if (auth instanceof NextResponse) return auth;
    } else if (agentId) {
      const auth = await requireAgent(request, agentId);
      if (auth instanceof NextResponse) return auth;
    } else {
      const auth = await requireLocation(request);
      if (auth instanceof NextResponse) return auth;
      scopeIds = await sourceIdsForLocation(auth.locationUuid);
      if (scopeIds.length === 0) return NextResponse.json([]);
    }

    const data = await pageAll<any>((from, to) => {
      let query = supabase
        .from('kb_sources')
        .select(`
          *,
          knowledge_base:knowledge_bases(id, name, location:locations(name))
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (knowledgeBaseId) {
        query = query.eq('knowledge_base_id', knowledgeBaseId);
      } else if (agentId) {
        // Fallback para compatibilidade
        query = query.eq('agent_id', agentId);
      } else if (scopeIds) {
        query = query.in('id', scopeIds);
      }

      return query;
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');

    if (!sourceId) {
      return NextResponse.json(
        { error: 'Source ID is required' },
        { status: 400 }
      );
    }

    const auth = await requireSource(request, sourceId);
    if (auth instanceof NextResponse) return auth;

    const { data: source, error: fetchError } = await supabase
      .from('kb_sources')
      .select('id, knowledge_base_id')
      .eq('id', sourceId)
      .single();

    if (fetchError || !source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    // Delete related knowledge_items and crawl_jobs using cascade function
    const { data: cascadeResult, error: cascadeError } = await supabase
      .rpc('delete_kb_source_cascade', { source_id_to_delete: sourceId });

    let itemsDeleted = 0;
    let jobsDeleted = 0;

    if (cascadeError) {
      console.error('Error in cascade delete:', cascadeError);
      // Fallback to manual deletion if function doesn't exist
      console.log('Falling back to manual deletion...');
      
      // Manual deletion of knowledge_items — pageAll evita perder chunks
      // de docs grandes (>1000) que ficariam orfaos com a query truncada.
      const itemsToDelete = await pageAll<{ id: string }>((from, to) =>
        supabase
          .from('knowledge_items')
          .select('id')
          .or(`metadata->>'source_id'.eq.${sourceId}`)
          .range(from, to)
      );

      if (itemsToDelete.length > 0) {
        const itemIds = itemsToDelete.map(item => item.id);
        // .in() tambem trunca em 1000 — paginar o delete em lotes
        const BATCH = 500;
        for (let i = 0; i < itemIds.length; i += BATCH) {
          const batch = itemIds.slice(i, i + BATCH);
          await supabase.from('knowledge_items').delete().in('id', batch);
        }
        itemsDeleted = itemIds.length;
      }

      // Manual deletion of crawl_jobs
      const { count } = await supabase
        .from('crawl_jobs')
        .delete()
        .eq('source_id', sourceId);
      jobsDeleted = count || 0;
    } else {
      const result = Array.isArray(cascadeResult) ? cascadeResult[0] : cascadeResult;
      itemsDeleted = result?.knowledge_items_deleted || 0;
      jobsDeleted = result?.crawl_jobs_deleted || 0;
    }

    console.log(`🗑️ Deleted ${itemsDeleted} knowledge items and ${jobsDeleted} crawl jobs`);

    // Finally, delete the source itself
    const { error: deleteError } = await supabase
      .from('kb_sources')
      .delete()
      .eq('id', sourceId);

    if (deleteError) {
      console.error('Error deleting source:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete source' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      deleted: {
        knowledge_items: itemsDeleted,
        crawl_jobs: jobsDeleted
      }
    });
  } catch (error) {
    console.error('Error deleting source:', error);
    return NextResponse.json(
      { error: 'Failed to delete source' },
      { status: 500 }
    );
  }
}

