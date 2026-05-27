import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
// Build browser do mammoth: o build Node (default do esm.sh) so aceita {buffer}/{path}
// e quebra com {arrayBuffer} ("Could not find file in options"). O browser aceita arrayBuffer.
import mammoth from "https://esm.sh/mammoth@1.8.0/mammoth.browser.js";
import Papa from "https://esm.sh/papaparse@5.4.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "kb-documents";
const CSV_ROW_LIMIT = 500;

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

type ExtractInput = {
  storage_path?: string;
  url?: string;
  mime: string;
};

type ExtractMeta = {
  page_count?: number;
  row_count?: number;
  total_rows_in_source?: number;
  truncated?: boolean;
};

async function fetchBuffer(input: ExtractInput): Promise<ArrayBuffer> {
  if (input.storage_path) {
    const supabase = makeSupabase();
    const { data, error } = await supabase.storage.from(BUCKET).download(input.storage_path);
    if (error || !data) throw new Error(`storage download failed: ${error?.message ?? "no data"}`);
    return await data.arrayBuffer();
  }
  if (input.url) {
    const res = await fetch(input.url);
    if (!res.ok) throw new Error(`fetch url failed: HTTP ${res.status}`);
    return await res.arrayBuffer();
  }
  throw new Error("either storage_path or url is required");
}

async function extractPdf(buf: ArrayBuffer): Promise<{ text: string; meta: ExtractMeta }> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const finalText = typeof text === "string" ? text : Array.isArray(text) ? text.join("\n\n") : "";
  return { text: finalText, meta: { page_count: totalPages } };
}

async function extractDocx(buf: ArrayBuffer): Promise<{ text: string; meta: ExtractMeta }> {
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return { text: result.value ?? "", meta: {} };
}

function csvToMarkdown(rows: Record<string, unknown>[], headers: string[]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${headers.map((h) => String(r[h] ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

async function extractCsv(buf: ArrayBuffer): Promise<{ text: string; meta: ExtractMeta }> {
  const decoder = new TextDecoder("utf-8");
  const csvText = decoder.decode(buf);
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const allRows = parsed.data;
  const headers = parsed.meta.fields ?? [];
  const truncated = allRows.length > CSV_ROW_LIMIT;
  const rows = truncated ? allRows.slice(0, CSV_ROW_LIMIT) : allRows;
  const text = headers.length > 0 ? csvToMarkdown(rows, headers) : "";
  const meta: ExtractMeta = {
    row_count: rows.length,
    total_rows_in_source: allRows.length,
    truncated,
  };
  return { text, meta };
}

function normalizeMime(mime: string, filename?: string): "pdf" | "docx" | "csv" | "unknown" {
  const m = (mime || "").toLowerCase();
  if (m === "application/pdf") return "pdf";
  if (m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (m === "text/csv" || m === "application/csv" || m === "application/vnd.ms-excel") return "csv";
  // fallback por extensao do filename
  const name = (filename ?? "").toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".csv")) return "csv";
  return "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => null) as (ExtractInput & { filename?: string }) | null;
    if (!body || !body.mime) return json({ error: "mime is required" }, 400);

    const kind = normalizeMime(body.mime, body.filename);
    if (kind === "unknown") return json({ error: "unsupported_mime", mime: body.mime }, 415);

    const buf = await fetchBuffer(body);

    let result: { text: string; meta: ExtractMeta };
    if (kind === "pdf") result = await extractPdf(buf);
    else if (kind === "docx") result = await extractDocx(buf);
    else result = await extractCsv(buf);

    const text = (result.text ?? "").trim();
    if (!text) {
      return json({
        ok: false,
        error: kind === "pdf" ? "no_text_extracted_maybe_scanned" : "no_text_extracted",
        meta: result.meta,
      }, 422);
    }

    return json({
      ok: true,
      kind,
      text,
      char_count: text.length,
      meta: result.meta,
    });
  } catch (err: any) {
    console.error("[kb-extract-document]", err);
    return json({ ok: false, error: err?.message || "internal_error" }, 500);
  }
});
