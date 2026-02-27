import { config } from './config';
import { supabase } from './supabase';

async function getLocationTokenServer(locationId: string): Promise<string> {
  const { data: row } = await supabase
    .from('location_token')
    .select('accesstoken, expires_at')
    .eq('locationid', locationId)
    .maybeSingle();

  if (row?.accesstoken && row?.expires_at) {
    const expSec = Math.floor(new Date(row.expires_at).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    if (now < expSec) {
      return row.accesstoken.replace(/^Bearer\s+/i, '');
    }
  }

  const { data: agencyData } = await supabase
    .from('agency_token')
    .select('access_token, refresh_token, expires_at')
    .eq('key', 'agency')
    .single();

  if (!agencyData) {
    throw new Error('Agency token not found');
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenExp = Math.floor(new Date(agencyData.expires_at).getTime() / 1000);

  let agencyToken = agencyData.access_token.replace(/^Bearer\s+/i, '');

  if (tokenExp - 120 <= now) {
    const refreshRes = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.ghl.clientId,
        client_secret: config.ghl.clientSecret,
        refresh_token: agencyData.refresh_token,
        user_type: 'Company',
        redirect_uri: config.ghl.redirectUri
      })
    });

    if (!refreshRes.ok) {
      const txt = await refreshRes.text();
      throw new Error(`Falha ao renovar agency token: ${txt}`);
    }

    const nd = await refreshRes.json();
    const new_expires = new Date((Math.floor(Date.now() / 1000) + nd.expires_in) * 1000);

    await supabase
      .from('agency_token')
      .update({
        access_token: nd.access_token,
        refresh_token: nd.refresh_token,
        expires_at: new_expires
      })
      .eq('key', 'agency');

    agencyToken = nd.access_token.replace(/^Bearer\s+/i, '');
  }

  const response = await fetch('https://services.leadconnectorhq.com/oauth/locationToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${agencyToken}`,
      'Version': '2021-07-28'
    },
    body: JSON.stringify({ locationId, companyId: config.ghl.companyId })
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Erro ao gerar token de location: ${raw}`);
  }

  const gh = JSON.parse(raw);
  const access_token = gh.access_token || gh.accessToken || gh.token || gh?.data?.access_token || gh?.data?.accessToken;
  const expires_in = Number(gh.expires_in || gh.expiresIn || 86400);

  const tokenStr = String(access_token || '').replace(/^Bearer\s+/i, '');
  if (!tokenStr) {
    throw new Error('Resposta sem access_token para location.');
  }

  const expiresAt = new Date((Math.floor(Date.now() / 1000) + expires_in) * 1000);

  await supabase
    .from('location_token')
    .upsert({
      locationid: locationId,
      accesstoken: tokenStr,
      expires_at: expiresAt.toISOString()
    }, {
      onConflict: 'locationid',
      ignoreDuplicates: false
    });

  return tokenStr;
}

export async function getLocationAccessToken(locationId: string, bearer?: string): Promise<string> {
  if (bearer) {
    const response = await fetch('https://services.leadconnectorhq.com/oauth/locationToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearer.replace(/^Bearer\s+/i, '')}`,
        'Version': '2021-07-28',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ locationId, companyId: config.ghl.companyId })
    });

    const text = await response.text();
    let json: any;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { rawText: text }; }

    const token = Array.isArray(json) ? json[0]?.access_token : json?.access_token;
    if (!token) {
      throw new Error(`GHL token missing access_token (status ${response.status}): ${JSON.stringify(json)}`);
    }
    return token.replace(/^Bearer\s+/i, '');
  }

  return await getLocationTokenServer(locationId);
}

export async function getLocationAccessTokenDetails(
  locationId: string,
  bearer?: string
): Promise<{ token: string; status: number; raw: unknown }> {
  if (bearer) {
    const response = await fetch('https://services.leadconnectorhq.com/oauth/locationToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearer.replace(/^Bearer\s+/i, '')}`,
        'Version': '2021-07-28',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ locationId, companyId: config.ghl.companyId })
    });

    const text = await response.text();
    let json: any;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { rawText: text }; }

    const token = Array.isArray(json) ? json[0]?.access_token : json?.access_token;
    if (!token) {
      throw new Error(`GHL token missing access_token (status ${response.status}): ${JSON.stringify(json)}`);
    }

    return {
      token: String(token).replace(/^Bearer\s+/i, ''),
      status: response.status,
      raw: json
    };
  }

  const token = await getLocationTokenServer(locationId);
  return { token, status: 200, raw: null };
}

