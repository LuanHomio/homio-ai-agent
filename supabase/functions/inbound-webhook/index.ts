import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

    const tools = [{
      function_declarations: [
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
      ]
    }];

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
    let contents: any[] = [{ role: "user", parts: [{ text: `Histórico:\n${history}\n\nContexto:\n${context}\n\nMensagens:\n${texts}${technicalContext}${derivedContext}${contactSnapshot}` }] }];
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
    for (let i = 0; i < 3; i++) {
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents, tools, systemInstruction: { parts: [{ text: prompt }] } })
      });
      
      if (!gRes.ok) {
        const errText = await gRes.text();
        throw new Error(`Gemini API error: ${gRes.status} - ${errText}`);
      }

      const gData = await gRes.json();
      const candidate = gData.candidates?.[0];
      const part = candidate?.content?.parts?.[0];

        if (part?.functionCall) {
        const call = part.functionCall;
        contents.push(candidate.content);

        const fnSlug = TOOL_MAP[call.name];
        const callArgs: Record<string, any> = call?.args && typeof call.args === "object" ? call.args : {};
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
        let toolResult;
        
        if (fnSlug) {
          try {
            const fnRes = await fetch(`${SB_URL}/functions/v1/${fnSlug}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SB_KEY}` },
              body: JSON.stringify(callArgs)
            });
            toolResult = await fnRes.json();
              debugSources.push({ at: nowIso(), source: "tool_call", name: call.name, ok: fnRes.ok, status: fnRes.status });
          } catch (err: any) {
            toolResult = { error: `Failed to call tool function: ${err?.message || String(err)}` };
              debugSources.push({ at: nowIso(), source: "tool_call", name: call.name, ok: false, error: err?.message || String(err) });
          }
        } else {
          toolResult = { error: "Tool not implemented" };
            debugSources.push({ at: nowIso(), source: "tool_call", name: call.name, ok: false, error: "not_implemented" });
        }

        contents.push({
          role: "function",
          parts: [{ functionResponse: { name: call.name, response: { content: toolResult } } }]
        });
        
        continue;
      }

      finalReply = part?.text || "Desculpe, não consegui formular uma resposta.";
        debugSources.push({ at: nowIso(), source: "decision_trace", step: "gemini_text_response" });
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
    let bId: any = null;
    const existing = await sb(`conversation_batches?conversation_id=eq.${conversationId}&status=eq.pending&order=scheduled_at.desc&limit=1`);
    bId = existing[0]?.id;
    if (bId) await sb(`conversation_batches?id=eq.${bId}`, "PATCH", { scheduled_at: sch });
    else { const nb = await sb("conversation_batches", "POST", { conversation_id: conversationId, status: "pending", scheduled_at: sch }); bId = nb[0].id; }
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
