import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireKb } from '@/lib/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'kb-documents';
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const SUPPORTED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/csv': 'csv',
  'application/csv': 'csv',
  'application/vnd.ms-excel': 'csv',
};

const EXT_FALLBACK: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv: 'text/csv',
};

function pickMime(file: File): { mime: string; kind: string } | null {
  const lc = (file.type || '').toLowerCase();
  if (SUPPORTED_MIME[lc]) return { mime: lc, kind: SUPPORTED_MIME[lc] };
  const name = file.name.toLowerCase();
  for (const ext of Object.keys(EXT_FALLBACK)) {
    if (name.endsWith(`.${ext}`)) return { mime: EXT_FALLBACK[ext], kind: ext };
  }
  return null;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 120);
}

async function dispatchProcessing(sourceId: string) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    if (!url || !key) {
      console.warn('[kb/upload] missing SUPABASE_URL/SERVICE_ROLE, skipping dispatch');
      return;
    }
    // dispara sem await — processamento eh assincrono
    fetch(`${url}/functions/v1/process-kb-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({ source_id: sourceId }),
    }).catch((err) => console.error('[kb/upload] dispatch failed:', err));
  } catch (err) {
    console.error('[kb/upload] dispatch threw:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const knowledgeBaseId = (form.get('knowledge_base_id') as string | null)?.trim();
    const agentIdRaw = (form.get('agent_id') as string | null)?.trim();

    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });
    if (!knowledgeBaseId) return NextResponse.json({ error: 'knowledge_base_id is required' }, { status: 400 });

    const auth = await requireKb(request, knowledgeBaseId);
    if (auth instanceof NextResponse) return auth;

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'file_too_large', max_bytes: MAX_SIZE_BYTES }, { status: 413 });
    }
    const picked = pickMime(file);
    if (!picked) {
      return NextResponse.json({ error: 'unsupported_mime', mime: file.type, name: file.name }, { status: 415 });
    }

    const { data: kb, error: kbErr } = await supabase
      .from('knowledge_bases')
      .select('id, location_id')
      .eq('id', knowledgeBaseId)
      .maybeSingle();
    if (kbErr) {
      console.error('[kb/upload] kb lookup error:', kbErr);
      return NextResponse.json({ error: 'kb_lookup_failed' }, { status: 500 });
    }
    if (!kb) return NextResponse.json({ error: 'kb_not_found' }, { status: 404 });

    let agentId = agentIdRaw && agentIdRaw.length > 0 ? agentIdRaw : null;
    if (!agentId) {
      const { data: link } = await supabase
        .from('agent_knowledge_bases')
        .select('agent_id')
        .eq('knowledge_base_id', knowledgeBaseId)
        .limit(1)
        .maybeSingle();
      agentId = link?.agent_id ?? null;
    }

    const sourceId = crypto.randomUUID();
    const safeName = sanitizeFilename(file.name);
    const storagePath = `${kb.location_id}/${knowledgeBaseId}/${sourceId}/${safeName}`;

    const arrayBuf = await file.arrayBuffer();
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, new Uint8Array(arrayBuf), {
        contentType: picked.mime,
        upsert: false,
      });
    if (uploadErr) {
      console.error('[kb/upload] storage upload error:', uploadErr);
      return NextResponse.json({ error: 'storage_upload_failed', detail: uploadErr.message }, { status: 500 });
    }

    const insertRow: any = {
      id: sourceId,
      url: null,
      scope: 'single',
      depth: 1,
      knowledge_base_id: knowledgeBaseId,
      agent_id: agentId,
      is_active: true,
      source_type: 'document',
      status: 'pending',
      metadata: {
        filename: file.name,
        mime: picked.mime,
        kind: picked.kind,
        size_bytes: file.size,
        storage_path: storagePath,
      },
    };
    const { data: source, error: insertErr } = await supabase
      .from('kb_sources')
      .insert([insertRow])
      .select('id, status, metadata, created_at')
      .single();
    if (insertErr) {
      console.error('[kb/upload] insert error:', insertErr);
      // melhor remover o arquivo orfao
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      return NextResponse.json({ error: 'source_insert_failed', detail: insertErr.message }, { status: 500 });
    }

    void dispatchProcessing(source.id);

    return NextResponse.json({
      source_id: source.id,
      status: source.status,
      filename: file.name,
      size_bytes: file.size,
      mime: picked.mime,
      created_at: source.created_at,
    }, { status: 201 });
  } catch (err: any) {
    console.error('[kb/upload]', err);
    return NextResponse.json({ error: 'internal_error', detail: err?.message }, { status: 500 });
  }
}
