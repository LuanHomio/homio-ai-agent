// Utility EF: cria custom fields em batch numa location GHL usando o location_token
// armazenado no nosso DB. Usada pra setup inicial de um agent (ex: Analista de CV).
//
// POST body: { locationId, fields: [{name, dataType, picklistOptions?, placeholder?, fieldKey?}] }
// Retorna: { created: [{name, id, fieldKey}], skipped: [{name, reason}] }
//
// dataType aceitos pelo GHL pra contato: TEXT, TEXTAREA, SINGLE_OPTIONS,
// MULTIPLE_OPTIONS, NUMERICAL, DATE, PHONE, EMAIL, CHECKBOX, RADIO.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GHL_API_URL = "https://services.leadconnectorhq.com";

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

type FieldDef = {
  name: string;
  dataType: string;
  picklistOptions?: string[];
  placeholder?: string;
  fieldKey?: string;
};

async function getLocationToken(supabase: any, locationId: string): Promise<string | null> {
  const { data } = await supabase
    .from("location_token")
    .select("accesstoken, expires_at")
    .eq("locationid", locationId)
    .maybeSingle();
  if (!data?.accesstoken) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  return String(data.accesstoken).replace(/^Bearer\s+/i, "");
}

async function listExistingFields(token: string, locationId: string): Promise<Array<{ id: string; name: string; fieldKey: string }>> {
  const res = await fetch(`${GHL_API_URL}/locations/${locationId}/customFields`, {
    headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const fields = data?.customFields ?? data?.fields ?? data ?? [];
  return Array.isArray(fields) ? fields.map((f: any) => ({ id: f.id, name: f.name, fieldKey: f.fieldKey })) : [];
}

async function createField(token: string, locationId: string, def: FieldDef): Promise<{ ok: boolean; id?: string; fieldKey?: string; error?: string; status?: number }> {
  const body: any = {
    name: def.name,
    dataType: def.dataType,
  };
  if (def.placeholder) body.placeholder = def.placeholder;
  if (def.fieldKey) body.fieldKey = def.fieldKey;
  if (Array.isArray(def.picklistOptions) && def.picklistOptions.length > 0) {
    body.options = def.picklistOptions.map((opt) => String(opt));
  }
  const res = await fetch(`${GHL_API_URL}/locations/${locationId}/customFields`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  let data: any;
  try { data = JSON.parse(txt); } catch { data = { rawText: txt }; }
  if (!res.ok) {
    return { ok: false, status: res.status, error: data?.message ?? data?.error ?? txt.slice(0, 300) };
  }
  const created = data?.customField ?? data;
  return { ok: true, id: created?.id, fieldKey: created?.fieldKey };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => null) as { locationId?: string; fields?: FieldDef[] } | null;
    if (!body?.locationId || !Array.isArray(body.fields) || body.fields.length === 0) {
      return json({ error: "locationId and fields[] are required" }, 400);
    }
    const supabase = makeSupabase();
    const token = await getLocationToken(supabase, body.locationId);
    if (!token) return json({ error: "no_valid_location_token", locationId: body.locationId }, 400);

    const existing = await listExistingFields(token, body.locationId);
    const existingByKey = new Map(existing.map((f) => [String(f.fieldKey || "").toLowerCase(), f]));
    const existingByName = new Map(existing.map((f) => [String(f.name || "").toLowerCase(), f]));

    const created: any[] = [];
    const skipped: any[] = [];

    for (const def of body.fields) {
      // skip se ja existir (mesmo fieldKey OU mesmo name)
      const byKey = def.fieldKey ? existingByKey.get(def.fieldKey.toLowerCase()) : null;
      const byName = existingByName.get(def.name.toLowerCase());
      const dup = byKey || byName;
      if (dup) {
        skipped.push({ name: def.name, reason: "already_exists", id: dup.id, fieldKey: dup.fieldKey });
        continue;
      }
      const r = await createField(token, body.locationId, def);
      if (r.ok) {
        created.push({ name: def.name, id: r.id, fieldKey: r.fieldKey, dataType: def.dataType });
      } else {
        skipped.push({ name: def.name, reason: "create_failed", status: r.status, error: r.error });
      }
    }

    return json({ ok: true, created, skipped });
  } catch (err: any) {
    console.error("[ghl-create-custom-fields]", err);
    return json({ ok: false, error: err?.message ?? "internal_error" }, 500);
  }
});
