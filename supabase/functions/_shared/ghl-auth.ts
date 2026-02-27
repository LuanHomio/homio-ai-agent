import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export const GHL_API_URL = "https://services.leadconnectorhq.com";
export const GHL_VERSION = "2021-04-15";

export async function getLocationToken(supabaseClient: any, locationId: string): Promise<string> {
  // 1. Check cache in location_token table
  const { data: row } = await supabaseClient
    .from("location_token")
    .select("accesstoken, expires_at")
    .eq("locationid", locationId)
    .maybeSingle();

  const now = Math.floor(Date.now() / 1000);
  if (row?.accesstoken && row?.expires_at) {
    const expSec = Math.floor(new Date(row.expires_at).getTime() / 1000);
    if (now < expSec) {
      return row.accesstoken.replace(/^Bearer\s+/i, "");
    }
  }

  // 2. Need to refresh or generate new. Get agency token first.
  const { data: agencyData } = await supabaseClient
    .from("agency_token")
    .select("access_token, refresh_token, expires_at")
    .eq("key", "agency")
    .single();

  if (!agencyData) throw new Error("Agency token not found");

  let agencyToken = agencyData.access_token.replace(/^Bearer\s+/i, "");
  const tokenExp = Math.floor(new Date(agencyData.expires_at).getTime() / 1000);

  // 3. Refresh agency token if close to expiry
  if (tokenExp - 120 <= now) {
    const refreshRes = await fetch(`${GHL_API_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: Deno.env.get("GHL_CLIENT_ID") ?? "",
        client_secret: Deno.env.get("GHL_CLIENT_SECRET") ?? "",
        refresh_token: agencyData.refresh_token,
        user_type: "Company",
        redirect_uri: Deno.env.get("GHL_AUTH_REDIRECT_URI") ?? ""
      })
    });

    if (!refreshRes.ok) {
      const txt = await refreshRes.text();
      throw new Error(`Falha ao renovar agency token: ${txt}`);
    }

    const nd = await refreshRes.json();
    const new_expires = new Date((Math.floor(Date.now() / 1000) + nd.expires_in) * 1000);
    
    await supabaseClient.from("agency_token").update({
      access_token: nd.access_token,
      refresh_token: nd.refresh_token,
      expires_at: new_expires
    }).eq("key", "agency");
    
    agencyToken = nd.access_token.replace(/^Bearer\s+/i, "");
  }

  // 4. Generate location token using agency token
  const response = await fetch(`${GHL_API_URL}/oauth/locationToken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${agencyToken}`,
      "Version": "2021-07-28"
    },
    body: JSON.stringify({
      locationId,
      companyId: Deno.env.get("GHL_COMPANY_ID") ?? ""
    })
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(`Erro ao gerar token de location: ${raw}`);

  const gh = JSON.parse(raw);
  const access_token = gh.access_token || gh.accessToken || gh.token || gh?.data?.access_token || gh?.data?.accessToken;
  const expires_in = Number(gh.expires_in || gh.expiresIn || 86400);
  const tokenStr = String(access_token || "").replace(/^Bearer\s+/i, "");

  if (!tokenStr) throw new Error("Resposta sem access_token para location.");

  // 5. Cache and return the new token
  const expiresAt = new Date((Math.floor(Date.now() / 1000) + expires_in) * 1000);
  await supabaseClient.from("location_token").upsert({
    locationid: locationId,
    accesstoken: tokenStr,
    expires_at: expiresAt.toISOString()
  }, { onConflict: "locationid", ignoreDuplicates: false });

  return tokenStr;
}

