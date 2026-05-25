import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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

async function resolveLocationUuid(supabase: ReturnType<typeof makeSupabase>, ghlLocationId: string) {
  const { data, error } = await supabase
    .from("locations")
    .select("id")
    .eq("ghl_location_id", ghlLocationId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function listAgents(supabase: ReturnType<typeof makeSupabase>, locationUuid: string) {
  const { data, error } = await supabase
    .from("agents")
    .select("id, name")
    .eq("location_id", locationUuid)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function getConversationState(supabase: ReturnType<typeof makeSupabase>, conversationId: string) {
  const { data, error } = await supabase
    .from("conversations")
    .select("agent_enabled, agent_id")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function toBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
  }
  if (typeof v === "number") return v !== 0;
  return undefined;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = makeSupabase();
    const url = new URL(req.url);

    if (req.method === "GET") {
      const conversationId = url.searchParams.get("conversationId") || url.searchParams.get("conversation_id");
      const locationId = url.searchParams.get("locationId") || url.searchParams.get("location_id");
      if (!conversationId || !locationId) {
        return json({ error: "Missing conversationId or locationId" }, 400);
      }

      const locationUuid = await resolveLocationUuid(supabase, locationId);
      if (!locationUuid) return json({ error: "Location not found", available_agents: [] }, 404);

      const agents = await listAgents(supabase, locationUuid);
      if (agents.length === 0) return json({ error: "No active agent for this location", available_agents: [] }, 404);

      const state = await getConversationState(supabase, conversationId);
      return json({
        agent_enabled: state?.agent_enabled ?? false,
        current_agent_id: state?.agent_id ?? agents[0].id,
        available_agents: agents,
      });
    }

    if (req.method === "POST") {
      const rawText = await req.text();
      let body: Record<string, unknown> = {};
      try {
        body = rawText ? JSON.parse(rawText) : {};
      } catch {
        // body nao-JSON (form-urlencoded ou plain) — segue com objeto vazio,
        // tenta extrair de query params abaixo
      }
      const query = Object.fromEntries(url.searchParams.entries()) as Record<string, unknown>;
      const merged = { ...query, ...body };

      // Aliases comuns enviados por workflows GHL ou outros provedores
      const conversationId = pick(merged, [
        "conversationId",
        "conversation_id",
        "conversationID",
        "conv_id",
      ]) as string | undefined;
      const locationId = pick(merged, [
        "locationId",
        "location_id",
        "locationID",
        "ghlLocationId",
        "ghl_location_id",
      ]) as string | undefined;
      const agentEnabledRaw = pick(merged, [
        "agent_enabled",
        "agentEnabled",
        "enabled",
        "enable",
      ]);
      const agentId = pick(merged, [
        "agent_id",
        "agentId",
      ]) as string | undefined;

      const agentEnabled = toBool(agentEnabledRaw);

      console.log("[toggle-agent-enabled] POST received", {
        headers: Object.fromEntries(req.headers.entries()),
        query,
        body,
        resolved: { conversationId, locationId, agentEnabled, agentId },
      });

      if (!conversationId || !locationId || agentEnabled === undefined) {
        return json(
          {
            error: "Missing conversationId, locationId or agent_enabled",
            received: { query, body },
            resolved: { conversationId, locationId, agent_enabled: agentEnabled, agent_id: agentId },
            hint: "Aceita aliases: conversationId|conversation_id|conv_id, locationId|location_id|ghlLocationId, agent_enabled|agentEnabled|enabled. agent_enabled aceita boolean ou string 'true'/'false'.",
          },
          400,
        );
      }

      const locationUuid = await resolveLocationUuid(supabase, locationId);
      if (!locationUuid) return json({ error: "Location not found", locationId }, 404);

      const agents = await listAgents(supabase, locationUuid);
      if (agents.length === 0) return json({ error: "No active agent for this location" }, 404);

      let resolvedAgentId: string | null = agentId ?? null;
      if (resolvedAgentId && !agents.some((a) => a.id === resolvedAgentId)) {
        return json({ error: "agent_id does not belong to this location", agent_id: resolvedAgentId, available_agents: agents }, 400);
      }
      if (!resolvedAgentId) resolvedAgentId = agents[0].id;

      const { data, error } = await supabase
        .from("conversations")
        .upsert(
          { conversation_id: conversationId, agent_enabled: agentEnabled, agent_id: resolvedAgentId, updated_at: new Date().toISOString() },
          { onConflict: "conversation_id" },
        )
        .select("agent_enabled, agent_id")
        .single();
      if (error) throw error;

      return json({
        agent_enabled: data.agent_enabled,
        current_agent_id: data.agent_id,
        available_agents: agents,
      });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err: any) {
    return json({ error: err?.message ?? String(err) }, 500);
  }
});
