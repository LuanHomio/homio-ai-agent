import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function makeSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

function splitLargeParagraph(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + size;
    if (end < text.length) {
      const lastDot = text.lastIndexOf(".", end);
      const lastQ = text.lastIndexOf("?", end);
      const lastE = text.lastIndexOf("!", end);
      const lastP = Math.max(lastDot, lastQ, lastE);
      if (lastP > start + size * 0.5) end = lastP + 1;
    }
    chunks.push(text.slice(start, end).trim());
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let cur = "";
  for (const p of paragraphs) {
    const para = p.trim();
    if (!para) continue;
    if (cur.length + para.length > size) {
      if (cur) chunks.push(cur.trim());
      if (para.length > size) {
        chunks.push(...splitLargeParagraph(para, size, overlap));
        cur = "";
      } else {
        cur = para;
      }
    } else {
      cur += (cur ? "\n\n" : "") + para;
    }
  }
  if (cur) chunks.push(cur.trim());
  return chunks;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    console.warn("[process-kb-document] OPENROUTER_API_KEY missing, skipping embedding");
    return null;
  }
  const clean = text.replace(/\n/g, " ").trim();
  if (!clean) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://homio.com.br",
        "X-Title": "AI Agent Knowledge Base",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: clean,
        encoding_format: "float",
      }),
    });
    if (!res.ok) {
      console.error("[process-kb-document] embedding HTTP", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.error("[process-kb-document] embedding error:", err);
    return null;
  }
}

async function callExtractEf(payload: { storage_path: string; mime: string; filename?: string }) {
  const sbUrl = Deno.env.get("SUPABASE_URL");
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${sbUrl}/functions/v1/kb-extract-document`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${sbKey}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(`extract failed: ${data?.error ?? res.status}`);
  }
  return data as { text: string; kind: string; char_count: number; meta: Record<string, unknown> };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let sourceId: string | null = null;
  let originalMeta: Record<string, any> = {};
  const supabase = makeSupabase();

  try {
    const body = await req.json().catch(() => null) as { source_id?: string } | null;
    if (!body?.source_id) return json({ error: "source_id is required" }, 400);
    sourceId = body.source_id;

    const { data: source, error: sourceErr } = await supabase
      .from("kb_sources")
      .select("id, knowledge_base_id, agent_id, source_type, status, metadata")
      .eq("id", sourceId)
      .maybeSingle();
    if (sourceErr) throw sourceErr;
    if (!source) return json({ error: "source_not_found" }, 404);
    if (source.source_type !== "document") return json({ error: "not_a_document_source" }, 400);

    const meta = (source.metadata ?? {}) as Record<string, any>;
    originalMeta = meta;
    const storagePath: string | undefined = meta.storage_path;
    const mime: string | undefined = meta.mime;
    const filename: string | undefined = meta.filename;
    if (!storagePath || !mime) return json({ error: "missing storage_path or mime in metadata" }, 400);

    await supabase.from("kb_sources").update({ status: "processing" }).eq("id", sourceId);

    const extracted = await callExtractEf({ storage_path: storagePath, mime, filename });
    const text = extracted.text;
    const extractMeta = (extracted.meta ?? {}) as Record<string, unknown>;

    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("no_chunks_generated");

    const documentRow = {
      knowledge_base_id: source.knowledge_base_id,
      content_type: "document" as const,
      content: text,
      title: filename ?? "documento",
      url: null,
      metadata: {
        source_id: sourceId,
        kind: extracted.kind,
        ...extractMeta,
      },
      token_count: estimateTokens(text),
    };

    const { data: savedDoc, error: docErr } = await supabase
      .from("knowledge_items")
      .insert([documentRow])
      .select("id")
      .single();
    if (docErr) throw docErr;

    const chunkInserts = await Promise.all(
      chunks.map(async (chunkContent, index) => {
        const embedding = await generateEmbedding(chunkContent);
        return {
          knowledge_base_id: source.knowledge_base_id,
          content_type: "chunk" as const,
          content: chunkContent,
          title: `${filename ?? "documento"} (Parte ${index + 1})`,
          url: null,
          embedding,
          metadata: {
            document_id: savedDoc.id,
            position: index,
            source_id: sourceId,
            kind: extracted.kind,
          },
          source_entity_id: savedDoc.id,
          source_entity_type: "document" as const,
          token_count: estimateTokens(chunkContent),
        };
      }),
    );

    const { error: chunksErr } = await supabase.from("knowledge_items").insert(chunkInserts);
    if (chunksErr) throw chunksErr;

    const chunksWithEmbedding = chunkInserts.filter((c) => c.embedding != null).length;

    await supabase
      .from("kb_sources")
      .update({
        status: "completed",
        metadata: {
          ...meta,
          ...extractMeta,
          extracted_char_count: text.length,
          chunk_count: chunks.length,
          chunks_with_embedding: chunksWithEmbedding,
          processed_at: new Date().toISOString(),
        },
      })
      .eq("id", sourceId);

    return json({
      ok: true,
      source_id: sourceId,
      document_id: savedDoc.id,
      chunk_count: chunks.length,
      chunks_with_embedding: chunksWithEmbedding,
    });
  } catch (err: any) {
    console.error("[process-kb-document]", err);
    if (sourceId) {
      await supabase
        .from("kb_sources")
        .update({
          status: "error",
          metadata: {
            ...originalMeta,
            error_message: err?.message ?? String(err),
            error_at: new Date().toISOString(),
          },
        })
        .eq("id", sourceId);
    }
    return json({ ok: false, error: err?.message ?? "internal_error" }, 500);
  }
});
