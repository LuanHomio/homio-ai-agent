import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

const GHL_LOCATION_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/locationToken';
const GHL_VERSION = '2021-07-28';

async function getValidAgencyToken() {
  const { data, error } = await supabase
    .from('agency_token')
    .select('access_token, refresh_token, expires_at')
    .eq('key', 'agency')
    .single();

  if (error || !data) {
    throw new Error('Token da agência não encontrado. Rode o authorize/callback primeiro.');
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenExp = Math.floor(new Date(data.expires_at).getTime() / 1000);

  if (tokenExp - 120 <= now) {
    const refreshRes = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.ghl.clientId,
        client_secret: config.ghl.clientSecret,
        refresh_token: data.refresh_token,
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

    const { error: upderr } = await supabase
      .from('agency_token')
      .update({
        access_token: nd.access_token,
        refresh_token: nd.refresh_token,
        expires_at: new_expires
      })
      .eq('key', 'agency');

    if (upderr) throw new Error(`DB update failed: ${upderr.message}`);

    return nd.access_token.replace(/^Bearer\s+/i, '');
  }

  return data.access_token.replace(/^Bearer\s+/i, '');
}

async function getOrCreateValidLocationToken(locationId: string, companyId: string) {
  const { data: row } = await supabase
    .from('location_token')
    .select('accesstoken, expires_at')
    .eq('locationid', locationId)
    .maybeSingle();

  if (row?.accesstoken && row?.expires_at) {
    const expSec = Math.floor(new Date(row.expires_at).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);

    if (now < expSec) {
      return {
        access_token: row.accesstoken.replace(/^Bearer\s+/i, ''),
        expires_at: row.expires_at,
        source: 'cache'
      };
    }
  }

  const agencyToken = await getValidAgencyToken();

  const response = await fetch(GHL_LOCATION_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${agencyToken}`,
      'Version': GHL_VERSION
    },
    body: JSON.stringify({ locationId, companyId })
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

  return {
    access_token: tokenStr,
    expires_at: expiresAt.toISOString(),
    source: 'fresh'
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const locationId = body?.locationId;

    if (!locationId) {
      return NextResponse.json(
        { error: "Campo 'locationId' é obrigatório no body." },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!config.ghl.companyId) {
      return NextResponse.json(
        { error: 'Variável de ambiente GHL_COMPANY_ID não configurada.' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tokenInfo = await getOrCreateValidLocationToken(String(locationId), config.ghl.companyId);

    return NextResponse.json({
      access_token: tokenInfo.access_token,
      expires_at: tokenInfo.expires_at,
      source: tokenInfo.source
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

