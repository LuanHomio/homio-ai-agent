import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKET = 'kb-documents';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabase
      .from('kb_sources')
      .select('id, knowledge_base_id, agent_id, status, metadata, created_at')
      .eq('id', params.id)
      .eq('source_type', 'document')
      .maybeSingle();
    if (error) {
      console.error('[kb/documents/:id] get error:', error);
      return NextResponse.json({ error: 'failed' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[kb/documents/:id] internal:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: source, error: srcErr } = await supabase
      .from('kb_sources')
      .select('id, metadata')
      .eq('id', params.id)
      .eq('source_type', 'document')
      .maybeSingle();
    if (srcErr) {
      console.error('[kb/documents/:id] lookup error:', srcErr);
      return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
    }
    if (!source) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const storagePath: string | undefined = (source.metadata as any)?.storage_path;

    // 1. Remove knowledge_items linkados (document row + chunks). source_id em metadata->>source_id
    const { error: kiErr } = await supabase
      .from('knowledge_items')
      .delete()
      .eq('metadata->>source_id', params.id);
    if (kiErr) {
      console.error('[kb/documents/:id] knowledge_items delete error:', kiErr);
      // segue mesmo assim — kb_sources eh a fonte de verdade visivel pro user
    }

    // 2. Remove arquivo do Storage
    if (storagePath) {
      const { error: storageErr } = await supabase.storage.from(BUCKET).remove([storagePath]);
      if (storageErr) {
        console.error('[kb/documents/:id] storage remove error:', storageErr);
      }
    }

    // 3. Remove kb_sources row
    const { error: delErr } = await supabase
      .from('kb_sources')
      .delete()
      .eq('id', params.id);
    if (delErr) {
      console.error('[kb/documents/:id] source delete error:', delErr);
      return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: params.id });
  } catch (err: any) {
    console.error('[kb/documents/:id] internal:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
