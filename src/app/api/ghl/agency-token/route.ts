import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';

export async function GET() {
  const { data, error } = await supabase
    .from('agency_token')
    .select('*')
    .eq('key', 'agency')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Nenhum token encontrado. Acesse /authorize primeiro.' },
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenExp = Math.floor(new Date(data.expires_at).getTime() / 1000);

  if (tokenExp - 120 <= now) {
    const refreshRes = await fetch(GHL_TOKEN_URL, {
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
      return NextResponse.json({ error: `Refresh falhou: ${txt}` }, { status: 500 });
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

    if (upderr) {
      return NextResponse.json(
        { error: `DB update failed: ${upderr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ access_token: nd.access_token });
  }

  return NextResponse.json({ access_token: data.access_token });
}

