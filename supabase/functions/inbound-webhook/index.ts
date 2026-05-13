import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  loadActiveActions,
  buildToolsFromActions,
  tryExecuteAgentAction,
  fnNameForAction,
  type ToolDeclaration,
  type ActionContext,
} from "../_shared/agent-action-runtime.ts";

declare const Deno: any;
declare const EdgeRuntime: any;

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wh-signature" };
const GHL_API_URL = "https://services.leadconnectorhq.com";
const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const KB_TOP_K = 10;
const KB_CONTEXT_MAX = 5;
const KB_SIMILARITY_THRESHOLD = 0.7;

function mapMessageTypeToGHLType(messageType: string, conversationProviderId?: string): string {
  if (conversationProviderId) return "SMS";
  const mapping: Record<string, string> = {
    TYPE_SMS: "SMS", TYPE_EMAIL: "Email", TYPE_WHATSAPP: "WhatsApp",
    TYPE_INSTAGRAM: "IG", TYPE_FACEBOOK: "FB", TYPE_GMB: "Custom",
    TYPE_WEBCHAT: "Live_Chat", Custom: "Custom", SMS: "SMS",
    Email: "Email", WhatsApp: "WhatsApp", IG: "IG", FB: "FB", Live_Chat: "Live_Chat"
  };
  return mapping[messageType] || messageType;
}

function unwrapWebhookPayload(input: any): any {
  if (Array.isArray(input)) {
    const first = input[0];
    return unwrapWebhookPayload(first?.body ?? first);
  }
  if (input && typeof input === "object") {
    const inner = (input as any).body;
    if (inner && typeof inner === "object" && (inner.type || inner.messageId || inner.messageType || inner.conversationId)) return inner;
  }
  return input;
}

function shouldBlockInternalIdRequest(text: string): boolean {
  const t = String(text || "");
  return /(\bid\s+do(?:\s+\w+){0,3}\s+contato\b)|(\bc[oó]digo\s+do(?:\s+\w+){0,3}\s+contato\b)|(\bcontact\s*id\b)|(\bcontactid\b)/i.test(t);
}

function keywordWantsContactSnapshot(text: string): boolean {
  const t = String(text || "").toLowerCase();
  return [
    "processo", "andamento", "status", "etapa", "funil", "pipeline", "proposta",
    "orçamento", "orcamento", "empresa", "cadastro", "cadastrada", "cadastrado",
    "valor", "valores", "preço", "preco", "fase",
    "meu cadastro", "meus dados", "dados", "informações", "informacoes",
    "email", "e-mail", "telefone", "celular", "endereço", "endereco", "nome"
  ].some((k) => t.includes(k));
}

function isCompanyQuestion(text: string): boolean {
  const t = String(text || "").toLowerCase();
  if (!t.includes("empresa")) return false;
  return ["cadastro", "cadastrad", "trabalho", "cadastr", "registr"].some((k) => t.includes(k));
}

function isCompanyCorrection(text: string): boolean {
  const t = String(text || "").toLowerCase();
  if (!t.includes("não é") && !t.includes("nao e")) return false;
  if (!t.includes(" é ") && !t.includes(" e ")) return false;
  return ["ltda", "s/a", "sa", "me", "eireli", "inc", "llc"].some((k) => t.includes(k)) || t.includes("empresa");
}

function isCompanyUpdateRequest(text: string): boolean {
  const t = String(text || "").toLowerCase();
  if (!t.includes("empresa")) return false;
  return ["alter", "atualiz", "muda", "mudar", "troca", "trocar", "corrig", "coloc", "seta", "setar"].some((k) => t.includes(k));
}

function isAddressQuestion(text: string): boolean {
  const t = String(text || "").toLowerCase();
  return ["endereço", "endereco", "rua", "cep", "bairro", "cidade", "estado", "uf", "país", "pais"].some((k) => t.includes(k));
}

function extractCompanyFromUpdateRequest(text: string): string {
  const raw = String(text || "").trim();
  const m = raw.match(/\b(?:para|pra|p\/)\s+(.+)$/i);
  if (m && m[1]) return String(m[1]).replace(/[?!\s]+$/g, "").trim();
  return "";
}

function extractAddressFromContactPayload(cData: any) {
  const c = cData?.contact ?? cData?.data ?? cData;
  const street = (c?.street || c?.address1 || c?.address_1 || c?.address || "") as string;
  const city = (c?.city || "") as string;
  const state = (c?.state || "") as string;
  const postalCode = (c?.postalCode || c?.postal_code || c?.zip || "") as string;
  const country = (c?.country || "") as string;
  const address2 = (c?.address2 || c?.address_2 || "") as string;
  return {
    street: String(street || "").trim(),
    address2: String(address2 || "").trim(),
    city: String(city || "").trim(),
    state: String(state || "").trim(),
    postalCode: String(postalCode || "").trim(),
    country: String(country || "").trim(),
  };
}

function extractCompanyFromUserCorrection(text: string): string {
  const raw = String(text || "").trim();
  const lower = raw.toLowerCase();
  const idx = Math.max(lower.lastIndexOf(" é "), lower.lastIndexOf(" e "));
  if (idx >= 0) return raw.slice(idx + 3).replace(/^[\.\:\-\s]+/, "").trim();
  return "";
}

function extractCompanyNameFromContactPayload(cData: any): string {
  const c = cData?.contact ?? cData?.data ?? cData;
  const candidates = [
    c?.companyName,
    c?.businessName,
    c?.company,
    c?.business_name,
    c?.company_name,
  ];
  const first = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  return first ? String(first).trim() : "";
}

function nowIso(): string {
  return new Date().toISOString();
}

function toShortJson(value: any, maxLen = 3500): string {
  try {
    const s = JSON.stringify(value);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "...(truncated)";
  } catch {
    return "";
  }
}

async function sb(path: string, method = "GET", body: any = null) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" },
    body: body ? JSON.stringify(body) : null
  });
  return res.ok ? res.json() : [];
}

async function sbRpc(fn: string, body: any) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.ok ? res.json() : [];
}

function normalizeQueryText(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

async function getQueryEmbedding(query: string): Promise<number[] | null> {
  const clean = normalizeQueryText(query);
  if (!clean) return null;

  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (openrouterKey) {
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openrouterKey}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: clean, encoding_format: "float" })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const emb = data?.data?.[0]?.embedding;
    return Array.isArray(emb) ? emb : null;
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: clean, encoding_format: "float" })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const emb = data?.data?.[0]?.embedding;
    return Array.isArray(emb) ? emb : null;
  }

  return null;
}

async function retrieveKnowledgeItems(query: string, kbIds: string[]): Promise<{ items: any[]; mode: string }> {
  if (!kbIds?.length) return { items: [], mode: "none" };

  const embedding = await getQueryEmbedding(query);
  if (embedding) {
    const vectorItems = await sbRpc("search_knowledge_items", {
      query_embedding: embedding,
      kb_ids: kbIds,
      content_types: ["faq", "chunk"],
      top_k: KB_TOP_K,
      similarity_threshold: KB_SIMILARITY_THRESHOLD
    });
    if (Array.isArray(vectorItems) && vectorItems.length) return { items: vectorItems, mode: "vector" };
  }

  const textItems = await sbRpc("search_knowledge_items_text", {
    query_text: normalizeQueryText(query),
    kb_ids: kbIds,
    content_types: ["faq", "chunk"],
    top_k: KB_TOP_K
  });
  if (Array.isArray(textItems) && textItems.length) return { items: textItems, mode: "text" };

  const fallback = await sb(
    `knowledge_items?select=id,content,content_type,title,url&knowledge_base_id=in.(${kbIds.join(",")})&content_type=in.(faq,chunk)&limit=${KB_TOP_K}`
  );
  return { items: Array.isArray(fallback) ? fallback : [], mode: "simple" };
}

function formatKnowledgeContext(items: any[]): string {
  const selected = (Array.isArray(items) ? items : []).slice(0, KB_CONTEXT_MAX);
  return selected.map((i: any) => {
    if (i?.content_type === "faq") return `Q: ${i?.title || i?.content}\nA: ${i?.content}`;
    if (i?.url) return `${i?.content}\n\nURL de referência: ${i.url}`;
    return i?.content;
  }).filter(Boolean).join("\n\n---\n\n");
}

async function getLocToken(locId: string) {
  const rows = await sb(`location_token?locationid=eq.${locId}`);
  if (rows[0]?.accesstoken && new Date(rows[0].expires_at).getTime() > Date.now()) return rows[0].accesstoken;
  
  const agencies = await sb(`agency_token?key=eq.agency`);
  const ag = agencies[0];
  let tk = ag.access_token;
  
  if (new Date(ag.expires_at).getTime() - 120000 <= Date.now()) {
    const res = await fetch(`${GHL_API_URL}/oauth/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: Deno.env.get("GHL_CLIENT_ID") || "", client_secret: Deno.env.get("GHL_CLIENT_SECRET") || "", refresh_token: ag.refresh_token, user_type: "Company", redirect_uri: Deno.env.get("GHL_AUTH_REDIRECT_URI") || "" })
    });
    const nd = await res.json();
    await sb(`agency_token?key=eq.agency`, "PATCH", { access_token: nd.access_token, refresh_token: nd.refresh_token, expires_at: new Date(Date.now() + nd.expires_in * 1000).toISOString() });
    tk = nd.access_token;
  }
  
  const res = await fetch(`${GHL_API_URL}/oauth/locationToken`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}`, Version: "2021-07-28" },
    body: JSON.stringify({ locationId: locId, companyId: Deno.env.get("GHL_COMPANY_ID") })
  });
  const gh = await res.json();
  const tok = (gh.access_token || gh.accessToken || "").replace(/^Bearer\s+/i, "");
  await fetch(`${SB_URL}/rest/v1/location_token?on_conflict=locationid`, {
    method: "POST", headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" },
    body: JSON.stringify({ locationid: locId, accesstoken: tok, expires_at: new Date(Date.now() + (gh.expires_in || 86400) * 1000).toISOString() })
  });
  return tok;
}

const ATTACH_MAX_INLINE_BYTES = 7 * 1024 * 1024;
const ATTACH_FETCH_TIMEOUT_MS = 15000;

// =====================================================
// Canais (channels) — detectar canal de origem de uma mensagem GHL
// =====================================================
// IDs dos custom providers whatsapp_homio (do projeto whatsapp_homio).
// Mantemos hardcoded por enquanto. Quando outras agencies entrarem, mover pra DB.
const WHATSAPP_HOMIO_PROVIDER_IDS = new Set([
  "67a4fa35ffae7881f31684f3", // WA Homio
  "679d1e13fe8b77fa62001590", // WA Homio 2
  "67a39b0a1d291e601c80c311", // WA Homio 3
  "67b8e49217347407acca7fd1", // Whats Homio
]);

type Channel = "whatsapp_homio" | "whatsapp_meta" | "instagram" | "unknown";

function detectChannel(messageType: any, conversationProviderId: any): Channel {
  const provId = String(conversationProviderId || "").trim();
  if (provId && WHATSAPP_HOMIO_PROVIDER_IDS.has(provId)) return "whatsapp_homio";

  const mt = String(messageType || "").toUpperCase();
  if (mt === "WHATSAPP" || mt === "TYPE_WHATSAPP") return "whatsapp_meta";
  if (mt === "IG" || mt === "TYPE_INSTAGRAM") return "instagram";
  return "unknown";
}

// =====================================================
// Cost tracking (PR A - billing/usage foundation)
// =====================================================
// Precos publicos do gemini-2.5-flash-lite em USD por milhao de tokens.
// Mantemos local pra calcular custo estimado por mensagem.
const GEMINI_PRICE_INPUT_USD_PER_M = 0.10;
const GEMINI_PRICE_OUTPUT_USD_PER_M = 0.40;
const USD_TO_BRL = 5.5; // conservador. Atualizar conforme cambio.

function calcCostBrl(promptTokens: number, outputTokens: number): number {
  const usd =
    (promptTokens / 1_000_000) * GEMINI_PRICE_INPUT_USD_PER_M +
    (outputTokens / 1_000_000) * GEMINI_PRICE_OUTPUT_USD_PER_M;
  return Number((usd * USD_TO_BRL).toFixed(6));
}

function getAttachmentUrl(att: any): string | null {
  if (typeof att === "string") return att;
  return att?.url || att?.fileUrl || att?.link || att?.href || null;
}

const AUDIO_EXTS = new Set(["ogg", "oga", "opus", "mp3", "m4a", "aac", "wav", "amr", "weba", "webm"]);
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"]);

function classifyAttachment(att: any): { kind: "pdf" | "image" | "docx" | "csv" | "audio" | "other"; mime: string } {
  const url = String(getAttachmentUrl(att) || "");
  const type = String(att?.type || att?.mimeType || att?.mime || "").toLowerCase();
  const ext = (url.split("?")[0].toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]) || "";
  if (type.startsWith("image/") || IMAGE_EXTS.has(ext)) {
    const finalMime = type.startsWith("image/") ? type : `image/${ext === "jpg" ? "jpeg" : ext}`;
    return { kind: "image", mime: finalMime };
  }
  if (type === "application/pdf" || ext === "pdf") return { kind: "pdf", mime: "application/pdf" };
  if (type.includes("wordprocessingml") || ext === "docx") {
    return { kind: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  if (type === "text/csv" || type === "application/csv" || ext === "csv") return { kind: "csv", mime: "text/csv" };
  if (type.startsWith("audio/") || AUDIO_EXTS.has(ext)) {
    const finalMime = type.startsWith("audio/") ? type : `audio/${ext === "oga" ? "ogg" : ext}`;
    return { kind: "audio", mime: finalMime };
  }
  return { kind: "other", mime: type || "application/octet-stream" };
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

async function fetchAttachmentBytes(url: string): Promise<{ bytes: Uint8Array; status: number } | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ATTACH_FETCH_TIMEOUT_MS);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return { bytes: new Uint8Array(), status: r.status };
    const ab = await r.arrayBuffer();
    return { bytes: new Uint8Array(ab), status: r.status };
  } catch {
    return null;
  }
}

const TRANSCRIPT_MARKER_RE = /🎤\s*\*?\s*transcri/i;

function hasInlineTranscript(text: string): boolean {
  return TRANSCRIPT_MARKER_RE.test(String(text || ""));
}

async function processInboundAttachments(rawPayloads: any[], combinedText: string): Promise<{ parts: any[]; trace: any[] }> {
  const parts: any[] = [];
  const trace: any[] = [];
  const transcriptInBody = hasInlineTranscript(combinedText);
  for (const payload of rawPayloads) {
    const atts = Array.isArray(payload?.attachments) ? payload.attachments : [];
    for (const att of atts) {
      const url = getAttachmentUrl(att);
      if (!url) { trace.push({ ok: false, skipped: "no_url" }); continue; }
      const { kind, mime } = classifyAttachment(att);

      if (kind === "pdf" || kind === "image") {
        const r = await fetchAttachmentBytes(url);
        if (!r) { trace.push({ kind, ok: false, error: "fetch_failed" }); continue; }
        if (r.bytes.length === 0) { trace.push({ kind, ok: false, status: r.status }); continue; }
        if (r.bytes.length > ATTACH_MAX_INLINE_BYTES) {
          const sizeMb = (r.bytes.length / 1024 / 1024).toFixed(1);
          parts.push({ text: `[anexo ${kind} grande (${sizeMb}MB) - não anexado ao prompt]` });
          trace.push({ kind, ok: false, error: "too_large", size_bytes: r.bytes.length });
          continue;
        }
        const data = bytesToBase64(r.bytes);
        parts.push({ inlineData: { mimeType: mime, data } });
        trace.push({ kind, ok: true, mime, size_bytes: r.bytes.length });
      } else if (kind === "docx" || kind === "csv") {
        try {
          const efRes = await fetch(`${SB_URL}/functions/v1/kb-extract-document`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SB_KEY}` },
            body: JSON.stringify({ url, mime }),
          });
          const ef = await efRes.json().catch(() => null);
          if (ef?.ok && ef?.text) {
            parts.push({ text: `[anexo ${kind} - conteúdo extraído]\n${ef.text}` });
            trace.push({ kind, ok: true, char_count: ef.char_count, meta: ef.meta });
          } else {
            parts.push({ text: `[anexo ${kind} - não consegui extrair conteúdo]` });
            trace.push({ kind, ok: false, error: ef?.error ?? `HTTP ${efRes.status}` });
          }
        } catch (err: any) {
          parts.push({ text: `[anexo ${kind} - erro na extração]` });
          trace.push({ kind, ok: false, error: err?.message ?? String(err) });
        }
      } else if (kind === "audio") {
        if (transcriptInBody) {
          parts.push({ text: "[O usuário enviou um áudio. A transcrição automática (sistema whatsapp_homio) já consta na mensagem acima, marcada com 🎤. Use essa transcrição como o conteúdo do áudio — NÃO afirme que não consegue ouvir áudios. Responda diretamente o que o usuário disse.]" });
          trace.push({ kind, ok: true, reason: "audio_transcript_in_message_text", mime });
        } else {
          parts.push({ text: "[O usuário enviou um áudio mas nenhuma transcrição automática foi anexada à mensagem. Peça educadamente para o usuário reenviar o conteúdo em texto, pois você não consegue processar áudios diretamente.]" });
          trace.push({ kind, ok: true, reason: "audio_no_transcript", mime });
        }
      } else {
        parts.push({ text: `[anexo recebido: ${mime} - tipo não suportado]` });
        trace.push({ kind, ok: false, mime, reason: "unsupported_kind" });
      }
    }
  }
  return { parts, trace };
}

async function runBatch(batchId: string) {
  try {
    const jobs = await sb(`inbound_jobs?batch_id=eq.${batchId}&status=eq.pending&order=created_at.asc`);
    if (!jobs?.length) return;
    const first = jobs[0];
    await sb(`inbound_jobs?batch_id=eq.${batchId}&status=eq.pending`, "PATCH", { status: "processing" });
    
    const convs = await sb(`conversations?conversation_id=eq.${first.conversation_id}&select=agent_enabled`);
    if (convs?.[0]?.agent_enabled !== true) {
      await sb(`inbound_jobs?batch_id=eq.${batchId}&status=eq.processing`, "PATCH", { status: "skipped", response_text: "Disabled", context_sources: [{ at: nowIso(), source: "decision_trace", step: "conversation_agent_disabled", conversationId: first.conversation_id }] });
      await sb(`conversation_batches?id=eq.${batchId}`, "PATCH", { status: "completed", locked_at: null });
      return;
    }

    const ags = await sb(`agents?id=eq.${first.agent_id}`);
    const agent = ags[0];
    if (agent?.is_active !== true) {
      await sb(`inbound_jobs?batch_id=eq.${batchId}&status=eq.processing`, "PATCH", { status: "skipped", response_text: "Disabled", context_sources: [{ at: nowIso(), source: "decision_trace", step: "agent_inactive", agentId: first.agent_id }] });
      await sb(`conversation_batches?id=eq.${batchId}`, "PATCH", { status: "completed", locked_at: null });
      return;
    }

    // Channel gating: skip se o canal da mensagem nao esta habilitado no agent.
    const channel = detectChannel(first.message_type, first.conversation_provider_id);
    const enabledChannels: string[] = Array.isArray(agent?.enabled_channels) ? agent.enabled_channels : [];
    if (enabledChannels.length > 0 && !enabledChannels.includes(channel)) {
      await sb(`inbound_jobs?batch_id=eq.${batchId}&status=eq.processing`, "PATCH", {
        status: "skipped",
        response_text: "Channel not enabled",
        context_sources: [{
          at: nowIso(),
          source: "decision_trace",
          step: "channel_not_enabled",
          detected_channel: channel,
          enabled_channels: enabledChannels,
          message_type: first.message_type,
          conversation_provider_id: first.conversation_provider_id,
        }],
      });
      await sb(`conversation_batches?id=eq.${batchId}`, "PATCH", { status: "completed", locked_at: null });
      return;
    }

    const kbIds = first.knowledge_base_ids || [];
    const texts = jobs.map((j: any) => j.message_text).join("\n\n");
    const kb = await retrieveKnowledgeItems(texts, kbIds);
    const context = formatKnowledgeContext(kb.items);

    const tok = await getLocToken(first.location_id);
    const hRes = await fetch(`${GHL_API_URL}/conversations/${first.conversation_id}/messages`, {
      headers: { Authorization: `Bearer ${tok}`, Version: "2021-04-15" }
    });
    const hData = hRes.ok ? await hRes.json() : {};
    
    let messages = [];
    if (hData && typeof hData === 'object') {
      if (Array.isArray(hData.messages)) {
        messages = hData.messages;
      } else if (hData.messages?.messages && Array.isArray(hData.messages.messages)) {
        messages = hData.messages.messages;
      }
    }

    const sortKey = (m: any) => {
      const d = m?.dateAdded || m?.createdAt || m?.created_at || m?.timestamp || m?.date;
      const n = d ? new Date(d).getTime() : 0;
      return Number.isFinite(n) ? n : 0;
    };
    const sortedMessages = [...messages].sort((a: any, b: any) => sortKey(a) - sortKey(b));
    const history = sortedMessages.slice(-10).map((m: any) => `${m.direction === "inbound" ? "Usuário" : "Assistente"}: ${m.body || m.message}`).join("\n");

    const prompt = `${agent.personality}\n${agent.objective}\n\nCONTEXTO IMPORTANTE (GHL/CRM):\n- Você é um agente interno operando dentro do CRM GoHighLevel (GHL).\n- O cliente NÃO tem acesso a IDs internos, tokens, payloads ou ao “cadastro bruto”.\n- NUNCA peça IDs internos (contactId, conversationId, etc) e NUNCA mencione esses IDs.\n- Se você não conseguir acessar um dado no CRM, diga que não conseguiu acessar a informação no momento.\n\nCAMPOS NATIVOS (contato) — dicionário prático:\n- Primeiro Nome: firstName\n- Sobrenome: lastName\n- Nome completo (Nome): name = firstName + lastName\n- Email: email\n- Telefone: phone\n- Empresa: companyName OU businessName OU company\n- Endereço (pense como um “objeto endereço” com campos):\n  - street/address1: Rua\n  - state: Estado\n  - country: País\n  - postalCode: CEP\n  - city: Cidade\n  - address2: Complemento\n\nREGRAS:\n- “Nome” normalmente é o nome completo (firstName + lastName), mas você pode atualizar Primeiro Nome e Sobrenome separadamente.\n\nCAPACIDADES:\n- Consultar o contato atual (GET CONTACT) para ver o cadastro.\n- Atualizar dados do contato (MANAGE CONTACT) quando o usuário solicitar.\n- Consultar campos personalizados disponíveis (GET CUSTOM FIELDS) se precisar entender IDs.\n\nFORMATAÇÃO:\n- Use *asteriscos* para negrito e _underscores_ para itálico.`;

    const BASE_DECLARATIONS: ToolDeclaration[] = [
      {
        name: "ghl_get_custom_fields",
        description: "Busca a lista de campos personalizados (custom fields) disponíveis na GoHighLevel para contatos ou oportunidades. Se locationId não for informado, o backend preencherá automaticamente.",
        parameters: {
          type: "object",
          properties: {
            locationId: { type: "string", description: "O ID da location na GHL" },
            model: { type: "string", enum: ["contact", "opportunity"], description: "O modelo de dados para buscar os campos" }
          },
          required: []
        }
      },
      {
        name: "ghl_manage_contact",
        description: "Ferramenta central para gerenciar contatos na GHL. Pode atualizar dados básicos, campos personalizados, adicionar/remover tags, criar notas e inserir em workflows, tudo em uma única chamada. Se locationId/contactId não forem informados, o backend preencherá automaticamente.",
        parameters: {
          type: "object",
          properties: {
            locationId: { type: "string" },
            contactId: { type: "string" },
            updates: {
              type: "object",
              description: "Campos para atualizar (firstName, lastName, name, email, phone, businessName/companyName/company, customFields).",
              properties: {
                firstName: { type: "string" },
                lastName: { type: "string" },
                name: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                businessName: { type: "string" },
                companyName: { type: "string" },
                company: { type: "string" },
                customFields: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "O ID único do campo" },
                      field_value: { type: "string", description: "O valor a ser gravado" }
                    },
                    required: ["id", "field_value"]
                  }
                }
              }
            },
            tags: { type: "array", items: { type: "string" } },
            removeTags: { type: "array", items: { type: "string" } },
            notes: { type: "array", items: { type: "string" } },
            workflowId: { type: "string" }
          },
          required: []
        }
      },
      {
        name: "ghl_get_conversation",
        description: "Obtém os detalhes técnicos de uma conversa específica (status, participantes, etc). Se locationId/conversationId não forem informados, o backend preencherá automaticamente.",
        parameters: {
          type: "object",
          properties: {
            locationId: { type: "string" },
            conversationId: { type: "string" }
          },
          required: []
        }
      },
      {
        name: "ghl_get_contact",
        description: "Obtém os detalhes do contato na GoHighLevel (inclui campos e custom fields). Se locationId/contactId não forem informados, o backend preencherá automaticamente.",
        parameters: {
          type: "object",
          properties: {
            locationId: { type: "string" },
            contactId: { type: "string" }
          },
          required: []
        }
      }
    ];

    // Carrega agent_actions ativas e gera function_declarations dinamicas
    const supabaseClient = createClient(SB_URL, SB_KEY);
    const agentActions = await loadActiveActions(supabaseClient, first.agent_id);
    const tools = buildToolsFromActions(agentActions, BASE_DECLARATIONS);
    const actionCtx: ActionContext = {
      supabaseClient,
      locationId: first.location_id,
      contactId: first.contact_id,
      conversationId: first.conversation_id,
      agentId: first.agent_id,
    };

    const TOOL_MAP: Record<string, string> = {
      "ghl_get_custom_fields": "ghl-get-custom-fields",
      "ghl_manage_contact": "ghl-manage-contact",
      "ghl_get_conversation": "ghl-get-conversation",
      "ghl_get_contact": "ghl-get-contact"
    };

    const debugSources: any[] = [];
    const flags = {
      keywordWantsContactSnapshot: keywordWantsContactSnapshot(texts),
      isCompanyQuestion: isCompanyQuestion(texts),
      isAddressQuestion: isAddressQuestion(texts)
    };
    debugSources.push({ at: nowIso(), source: "kb_retrieval", mode: kb.mode, kb_ids_count: kbIds.length, returned: Array.isArray(kb.items) ? kb.items.length : 0 });
    debugSources.push({
      at: nowIso(),
      source: "decision_trace",
      step: "start_runBatch",
      batchId,
      contactId: first.contact_id,
      conversationId: first.conversation_id,
      locationId: first.location_id,
      flags
    });

    // Acumulador de uso pra captura no fim do batch (PR A).
    const usageTotals = { promptTokens: 0, outputTokens: 0 };

    let attachmentExtraParts: any[] = [];
    try {
      const messageIds = (jobs as any[]).map((j) => j.message_id).filter(Boolean);
      if (messageIds.length > 0) {
        const idList = messageIds.map((id) => `"${id}"`).join(",");
        const inMsgs = await sb(`inbound_messages?message_id=in.(${idList})&select=message_id,raw_payload`);
        const payloads = (inMsgs || []).map((m: any) => m?.raw_payload).filter(Boolean);
        const result = await processInboundAttachments(payloads, texts);
        attachmentExtraParts = result.parts;
        if (result.trace.length > 0) {
          debugSources.push({
            at: nowIso(),
            source: "attachments",
            ok: true,
            parts_count: result.parts.length,
            trace: result.trace,
          });
        }
      }
    } catch (err: any) {
      debugSources.push({ at: nowIso(), source: "attachments", ok: false, error: err?.message ?? String(err) });
    }

    let contactSnapshot = "";
    let contactCompany = "";
    let contactPrefetchOk = false;
    let contactAddress: any = null;
    if (flags.keywordWantsContactSnapshot) {
      try {
        const cRes = await fetch(`${GHL_API_URL}/contacts/${first.contact_id}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", Version: "2021-07-28" }
        });
        const cData = cRes.ok ? await cRes.json() : {};
        contactPrefetchOk = Boolean(cRes.ok);
        contactCompany = extractCompanyNameFromContactPayload(cData);
        contactAddress = extractAddressFromContactPayload(cData);
        debugSources.push({
          at: nowIso(),
          source: "ghl_contact_prefetch",
          ok: contactPrefetchOk,
          status: (cRes as any)?.status,
          company: contactCompany || null,
          note: contactCompany ? "company_field_found" : "company_field_missing",
          address_fields_present: contactAddress ? {
            street: Boolean(contactAddress.street),
            address2: Boolean(contactAddress.address2),
            city: Boolean(contactAddress.city),
            state: Boolean(contactAddress.state),
            postalCode: Boolean(contactAddress.postalCode),
            country: Boolean(contactAddress.country),
          } : null
        });
        contactSnapshot = `\n\n[Dados do contato (sistema) - não mencionar ao usuário]\n${toShortJson(cData)}`;
      } catch {
        contactSnapshot = "";
        debugSources.push({ at: nowIso(), source: "ghl_contact_prefetch", ok: false, error: "exception" });
      }
    }

    const technicalContext = `\n\n[Dados técnicos - não mencionar ao usuário]\nlocationId=${first.location_id}\nconversationId=${first.conversation_id}\ncontactId=${first.contact_id}\nmessageType=${first.message_type || ""}\nconversationProviderId=${first.conversation_provider_id || ""}`;
    const derivedContext = contactCompany ? `\n\n[Derivado - não mencionar ao usuário]\nempresa_cadastrada=${contactCompany}` : "";
    let contents: any[] = [{
      role: "user",
      parts: [
        { text: `Histórico:\n${history}\n\nContexto:\n${context}\n\nMensagens:\n${texts}${technicalContext}${derivedContext}${contactSnapshot}` },
        ...attachmentExtraParts,
      ],
    }];
    let finalReply = "Desculpe, tive um problema ao processar sua mensagem.";

    if (flags.keywordWantsContactSnapshot && !contactPrefetchOk && !isCompanyCorrection(texts)) {
      debugSources.push({ at: nowIso(), source: "decision_trace", step: "prefetch_required_but_failed", ok: false });
      finalReply = "No momento não consegui acessar as informações do seu cadastro. Por favor, tente novamente em alguns minutos.";
    } else
    if (isCompanyUpdateRequest(texts)) {
      const targetCompany = extractCompanyFromUpdateRequest(texts);
      debugSources.push({ at: nowIso(), source: "decision_trace", step: "company_update_request_detected", targetCompany: targetCompany || null });
      if (!targetCompany) {
        finalReply = "Entendi. Para eu atualizar a empresa no seu cadastro, me diga o nome exato da empresa.";
      } else {
        try {
          const fnRes = await fetch(`${SB_URL}/functions/v1/ghl-manage-contact`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SB_KEY}` },
            body: JSON.stringify({ locationId: first.location_id, contactId: first.contact_id, updates: { companyName: targetCompany } })
          });
          debugSources.push({ at: nowIso(), source: "tool_call", name: "ghl_manage_contact", ok: fnRes.ok, status: fnRes.status });
          if (fnRes.ok) {
            finalReply = `Pronto — atualizei a empresa no seu cadastro para: *${targetCompany}*.`;
          } else {
            finalReply = "No momento não consegui atualizar a empresa no seu cadastro. Por favor, tente novamente em alguns minutos.";
          }
        } catch (err: any) {
          debugSources.push({ at: nowIso(), source: "tool_call", name: "ghl_manage_contact", ok: false, error: err?.message || String(err) });
          finalReply = "No momento não consegui atualizar a empresa no seu cadastro. Por favor, tente novamente em alguns minutos.";
        }
      }
    } else
    if (isCompanyCorrection(texts)) {
      const corrected = extractCompanyFromUserCorrection(texts);
      debugSources.push({ at: nowIso(), source: "decision_trace", step: "company_correction_detected", corrected: corrected || null });
      if (corrected) {
        finalReply = `Perfeito — entendi. A empresa correta é *${corrected}*.\n\nQuer que eu atualize a empresa cadastrada no seu cadastro para *${corrected}*?`;
      } else {
        finalReply = "Entendi. No momento não consegui identificar com segurança qual é a empresa correta para atualizar. Você pode me confirmar o nome completo da empresa?";
      }
    } else
    if (flags.isCompanyQuestion) {
      if (contactCompany) {
        debugSources.push({ at: nowIso(), source: "decision_trace", step: "answer_company_deterministic", ok: true });
        finalReply = `A empresa cadastrada no seu cadastro é: *${contactCompany}*.\n\nSe quiser, posso atualizar para a empresa correta — me diga o nome exato.`;
      } else {
        debugSources.push({ at: nowIso(), source: "decision_trace", step: "answer_company_deterministic", ok: false, reason: "company_field_missing_or_prefetch_failed" });
        finalReply = "No momento não consegui acessar a empresa cadastrada no seu cadastro. Por favor, tente novamente em alguns minutos.";
      }
    } else {
    if (flags.isAddressQuestion) {
      if (!contactPrefetchOk) {
        debugSources.push({ at: nowIso(), source: "decision_trace", step: "answer_address_deterministic", ok: false, reason: "prefetch_failed" });
        finalReply = "No momento não consegui acessar o endereço do seu cadastro. Por favor, tente novamente em alguns minutos.";
      } else {
        const a = contactAddress || {};
        const hasAny = Boolean(a.street || a.address2 || a.city || a.state || a.postalCode || a.country);
        debugSources.push({ at: nowIso(), source: "decision_trace", step: "answer_address_deterministic", ok: hasAny });
        if (!hasAny) {
          finalReply = "No momento não encontrei endereço cadastrado no seu cadastro.";
        } else {
          const lines: string[] = [];
          if (a.street) lines.push(`- *Rua*: ${a.street}`);
          if (a.address2) lines.push(`- *Complemento*: ${a.address2}`);
          if (a.city) lines.push(`- *Cidade*: ${a.city}`);
          if (a.state) lines.push(`- *Estado*: ${a.state}`);
          if (a.postalCode) lines.push(`- *CEP*: ${a.postalCode}`);
          if (a.country) lines.push(`- *País*: ${a.country}`);
          const missing: string[] = [];
          if (!a.street) missing.push("Rua");
          if (!a.state) missing.push("Estado");
          if (!a.postalCode) missing.push("CEP");
          if (!a.country) missing.push("País");
          finalReply = `No seu cadastro, eu tenho estas informações de endereço:\n${lines.join("\n")}${missing.length ? `\n\nAinda não tenho: ${missing.join(", ")}.` : ""}`;
        }
      }
    } else {
    const preview = (v: any, max = 300) => {
      try {
        const s = typeof v === "string" ? v : JSON.stringify(v);
        return s.length > max ? s.substring(0, max) + "...[truncated]" : s;
      } catch { return "[unserializable]"; }
    };
    const GEMINI_MODEL = "gemini-2.5-flash-lite";
    debugSources.push({
      at: nowIso(),
      source: "decision_trace",
      step: "gemini_loop_start",
      model: GEMINI_MODEL,
      prompt_preview: preview(prompt, 500),
      tools_count: Array.isArray(tools?.[0]?.function_declarations) ? tools[0].function_declarations.length : 0,
      max_iters: 3,
    });
    for (let i = 0; i < 3; i++) {
      const geminiStartedAt = Date.now();
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          tools,
          systemInstruction: { parts: [{ text: prompt }] },
          // Fix bug "Desculpe, nao consegui formular uma resposta": gemini-2.5-flash-lite
          // ativa thinking por default e em chamadas pos-tool consome todo o output budget
          // em raciocinio interno, retornando part.text vazio com finishReason=STOP.
          // thinkingBudget=0 desliga o thinking; mvp atual e single-tool por turno (baixo risco).
          generationConfig: { maxOutputTokens: 2048, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
        })
      });

      if (!gRes.ok) {
        const errText = await gRes.text();
        debugSources.push({
          at: nowIso(),
          source: "gemini_call",
          iter: i,
          ok: false,
          status: gRes.status,
          latency_ms: Date.now() - geminiStartedAt,
          error_preview: preview(errText, 500),
        });
        throw new Error(`Gemini API error: ${gRes.status} - ${errText}`);
      }

      const gData = await gRes.json();
      const candidate = gData.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      const u = gData.usageMetadata ?? {};
      usageTotals.promptTokens += Number(u.promptTokenCount) || 0;
      usageTotals.outputTokens += Number(u.candidatesTokenCount) || 0;
      debugSources.push({
        at: nowIso(),
        source: "gemini_call",
        iter: i,
        ok: true,
        latency_ms: Date.now() - geminiStartedAt,
        finishReason: candidate?.finishReason ?? null,
        promptFeedback: gData?.promptFeedback ?? null,
        tokens: {
          prompt: u.promptTokenCount ?? null,
          candidates: u.candidatesTokenCount ?? null,
          total: u.totalTokenCount ?? null,
        },
        decision: part?.functionCall ? "tool_call" : (part?.text ? "text" : "empty"),
        tool_name: part?.functionCall?.name ?? null,
      });

        if (part?.functionCall) {
        const call = part.functionCall;
        contents.push(candidate.content);

        const callArgs: Record<string, any> = call?.args && typeof call.args === "object" ? call.args : {};
        let toolResult;

        // 1. Tenta primeiro como agent_action dinamica (function name = action_${actionId})
        const isAgentAction = agentActions.some((a) => fnNameForAction(a) === call.name);
        const toolStartedAt = Date.now();
        if (isAgentAction) {
          try {
            const result = await tryExecuteAgentAction(call.name, callArgs, agentActions, actionCtx);
            toolResult = result ?? { error: "Action not found" };
            debugSources.push({
              at: nowIso(),
              source: "agent_action",
              name: call.name,
              ok: !!toolResult?.success,
              latency_ms: Date.now() - toolStartedAt,
              args_preview: preview(callArgs, 400),
              result_preview: preview(toolResult, 400),
            });
          } catch (err: any) {
            toolResult = { error: `Failed to execute agent action: ${err?.message || String(err)}` };
            debugSources.push({
              at: nowIso(),
              source: "agent_action",
              name: call.name,
              ok: false,
              latency_ms: Date.now() - toolStartedAt,
              error: err?.message || String(err),
              args_preview: preview(callArgs, 400),
            });
          }
        } else {
          // 2. Fallback pro TOOL_MAP estatico (4 tools base)
          const fnSlug = TOOL_MAP[call.name];
          const autofilled: string[] = [];
          if (call.name === "ghl_manage_contact") {
            if (!callArgs.locationId) { callArgs.locationId = first.location_id; autofilled.push("locationId"); }
            if (!callArgs.contactId) { callArgs.contactId = first.contact_id; autofilled.push("contactId"); }
          } else if (call.name === "ghl_get_custom_fields") {
            if (!callArgs.locationId) { callArgs.locationId = first.location_id; autofilled.push("locationId"); }
          } else if (call.name === "ghl_get_conversation") {
            if (!callArgs.locationId) { callArgs.locationId = first.location_id; autofilled.push("locationId"); }
            if (!callArgs.conversationId) { callArgs.conversationId = first.conversation_id; autofilled.push("conversationId"); }
          } else if (call.name === "ghl_get_contact") {
            if (!callArgs.locationId) { callArgs.locationId = first.location_id; autofilled.push("locationId"); }
            if (!callArgs.contactId) { callArgs.contactId = first.contact_id; autofilled.push("contactId"); }
          }
          debugSources.push({ at: nowIso(), source: "decision_trace", step: "tool_autofill", tool: call.name, autofilled });

          if (fnSlug) {
            try {
              const fnRes = await fetch(`${SB_URL}/functions/v1/${fnSlug}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SB_KEY}` },
                body: JSON.stringify(callArgs)
              });
              toolResult = await fnRes.json();
              debugSources.push({
                at: nowIso(),
                source: "tool_call",
                name: call.name,
                ok: fnRes.ok,
                status: fnRes.status,
                latency_ms: Date.now() - toolStartedAt,
                args_preview: preview(callArgs, 400),
                result_preview: preview(toolResult, 400),
              });
            } catch (err: any) {
              toolResult = { error: `Failed to call tool function: ${err?.message || String(err)}` };
              debugSources.push({
                at: nowIso(),
                source: "tool_call",
                name: call.name,
                ok: false,
                latency_ms: Date.now() - toolStartedAt,
                error: err?.message || String(err),
                args_preview: preview(callArgs, 400),
              });
            }
          } else {
            toolResult = { error: "Tool not implemented" };
            debugSources.push({ at: nowIso(), source: "tool_call", name: call.name, ok: false, error: "not_implemented" });
          }
        }

        contents.push({
          role: "function",
          parts: [{ functionResponse: { name: call.name, response: { content: toolResult } } }]
        });

        continue;
      }

      finalReply = part?.text || "Desculpe, não consegui formular uma resposta.";
      debugSources.push({
        at: nowIso(),
        source: "decision_trace",
        step: "gemini_text_response",
        ok: !!part?.text,
        iter: i,
        text_length: part?.text?.length ?? 0,
        finishReason: candidate?.finishReason ?? null,
        promptFeedback: gData?.promptFeedback ?? null,
        reply_preview: preview(finalReply, 400),
      });
      break;
    }
    }
    }

    if (shouldBlockInternalIdRequest(finalReply)) {
      finalReply = "No momento não consegui acessar essa informação com segurança. Por favor, tente novamente em alguns minutos.";
      debugSources.push({ at: nowIso(), source: "decision_trace", step: "blocked_internal_id_request", ok: true });
    }

    const metaMsgRows = await sb(`inbound_messages?message_id=eq.${first.message_id}&select=raw_payload,message_type,conversation_provider_id&limit=1`);
    const metaMsg = metaMsgRows?.[0];
    const inferredMessageType = first.message_type || metaMsg?.message_type || metaMsg?.raw_payload?.messageType || metaMsg?.raw_payload?.message_type || metaMsg?.raw_payload?.type || "WhatsApp";
    const inferredConversationProviderId = first.conversation_provider_id || metaMsg?.conversation_provider_id || metaMsg?.raw_payload?.conversationProviderId || metaMsg?.raw_payload?.conversation_provider_id;
    const replyType = mapMessageTypeToGHLType(String(inferredMessageType), inferredConversationProviderId ? String(inferredConversationProviderId) : undefined);
    const replyBody: any = { type: replyType, contactId: first.contact_id, message: finalReply };
    if (inferredConversationProviderId) replyBody.conversationProviderId = inferredConversationProviderId;

    await fetch(`${GHL_API_URL}/conversations/messages`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}`, Version: "2021-04-15" },
      body: JSON.stringify(replyBody)
    });

    await sb(`inbound_jobs?batch_id=eq.${batchId}&status=eq.processing`, "PATCH", { status: "completed", response_text: finalReply, context_sources: debugSources });
    await sb(`conversation_batches?id=eq.${batchId}`, "PATCH", { status: "completed", locked_at: null });

    // Captura de uso (PR A). Roda apos sucesso do batch.
    // location_id no inbound_jobs e o GHL string. Usamos agent.location_id (UUID interno).
    try {
      const locationUuid = (agent as any)?.location_id;
      if (locationUuid && (usageTotals.promptTokens > 0 || usageTotals.outputTokens > 0)) {
        const costBrl = calcCostBrl(usageTotals.promptTokens, usageTotals.outputTokens);
        const today = new Date().toISOString().slice(0, 10);
        await sbRpc("increment_agent_usage", {
          p_agent_id: first.agent_id,
          p_location_id: locationUuid,
          p_date: today,
          p_messages: 1,
          p_prompt_tokens: usageTotals.promptTokens,
          p_output_tokens: usageTotals.outputTokens,
          p_cost_brl: costBrl,
        });
      }
    } catch (err) {
      console.error(`[usage] increment failed for batch ${batchId}:`, err);
      // intencional: nao falha o batch por causa de captura de uso
    }
  }
  catch (err: any) {
    console.error(`Error in runBatch for ${batchId}:`, err);
    await sb(`inbound_jobs?batch_id=eq.${batchId}&status=eq.processing`, "PATCH", { status: "error", error_message: err.message });
    await sb(`conversation_batches?id=eq.${batchId}`, "PATCH", { status: "error", locked_at: null });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const raw = await req.json();
    const payload = unwrapWebhookPayload(raw);

    const direction = payload?.direction;
    const messageType = payload?.messageType || payload?.message_type || payload?.type;
    if (direction && String(direction).toLowerCase() !== "inbound") return new Response("Ignored", { headers: corsHeaders });
    if (messageType && String(messageType).toUpperCase() === "CALL") return new Response("Ignored", { headers: corsHeaders });

    const messageId = payload?.messageId || payload?.message_id || payload?.webhookId || payload?.webhook_id || `${payload?.conversationId || payload?.conversation_id || "unknown"}:${payload?.dateAdded || payload?.timestamp || Date.now()}`;
    const conversationId = payload?.conversationId || payload?.conversation_id;
    const locationId = payload?.locationId || payload?.location_id;
    const contactId = payload?.contactId || payload?.contact_id;
    const conversationProviderId = payload?.conversationProviderId || payload?.conversation_provider_id;
    const bodyText = typeof payload?.body === "string" ? payload.body : (typeof payload?.body?.body === "string" ? payload.body.body : "");

    if (!conversationId || !locationId || !contactId) return new Response("Bad Request", { status: 400, headers: corsHeaders });
    const exists = await sb(`inbound_messages?message_id=eq.${messageId}&select=id`);
    if (exists.length) return new Response("Duplicate", { headers: corsHeaders });
    const convs = await sb(`conversations?conversation_id=eq.${conversationId}&select=agent_enabled`);
    if (convs?.[0]?.agent_enabled !== true) return new Response("Disabled", { headers: corsHeaders });
    const locs = await sb(`locations?ghl_location_id=eq.${locationId}&select=id`);
    if (!locs?.[0]?.id) return new Response("Disabled", { headers: corsHeaders });
    const ags = await sb(`agents?location_id=eq.${locs[0].id}&is_active=eq.true&order=created_at.desc&limit=1`);
    const ag = ags[0];
    if (!ag?.id) return new Response("Disabled", { headers: corsHeaders });
    const kbRes = await sb(`agent_knowledge_bases?agent_id=eq.${ag.id}&select=knowledge_base_id`);
    const kbIds = kbRes.map((k: any) => k.knowledge_base_id);
    await sb("inbound_messages", "POST", { message_id: messageId, location_id: locationId, contact_id: contactId, conversation_id: conversationId, body: bodyText, raw_payload: payload, agent_id: ag.id, message_type: messageType, conversation_provider_id: conversationProviderId });
    const now = new Date();
    const sch = new Date(now.getTime() + 15000).toISOString();
    const batchResult = await sbRpc('upsert_conversation_batch', { p_conversation_id: conversationId, p_scheduled_at: sch });
    const bId = batchResult?.[0]?.batch_id;
    if (!bId) return new Response("Batch creation failed", { status: 500, headers: corsHeaders });
            await sb("inbound_jobs", "POST", { message_id: messageId, agent_id: ag.id, location_id: locationId, contact_id: contactId, conversation_id: conversationId, status: "pending", message_text: bodyText, batch_id: bId, scheduled_at: sch, knowledge_base_ids: kbIds, message_type: messageType, conversation_provider_id: conversationProviderId });
            const lock = await sbRpc('acquire_specific_batch_lock', { target_batch_id: bId, now_iso: now.toISOString(), lock_expiry_iso: new Date(now.getTime() - 120000).toISOString() });
            
            if (lock?.length) {
              const processPromise = (async () => {
                try {
                  for(let i=0; i<25; i++) {
                    const res = await sb(`conversation_batches?id=eq.${bId}&select=scheduled_at,status`);
                    if (!res[0] || res[0].status !== "pending") break;
                    const wait = new Date(res[0].scheduled_at).getTime() - Date.now();
                    if (wait <= 0) break;
                    await new Promise(r => setTimeout(r, Math.min(wait, 2000)));
                  }
                  await runBatch(bId);
                } catch (err) {
                  console.error(`Error in background batch processing for ${bId}:`, err);
                }
              })();

              if (typeof EdgeRuntime !== "undefined") {
                EdgeRuntime.waitUntil(processPromise);
              }
            }
            return new Response(JSON.stringify({ success: true, batchId: bId }), { headers: corsHeaders });
          } catch (e: any) {
    return new Response(e.message, { status: 500, headers: corsHeaders });
  }
});
