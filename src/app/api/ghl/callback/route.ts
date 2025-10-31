import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  const clientId = process.env.GHL_CLIENT_ID!
  const clientSecret = process.env.GHL_CLIENT_SECRET!
  const redirectUri = process.env.GHL_AUTH_REDIRECT_URI!

  const tokenRes = await fetch('https://services.leadconnectorhq.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    })
  })

  if (!tokenRes.ok) {
    const txt = await tokenRes.text()
    return new NextResponse(`Token exchange failed: ${txt}`, { status: 500 })
  }

  const data = await tokenRes.json() as { access_token: string; refresh_token: string; expires_in: number }
  const expiresAt = new Date((Math.floor(Date.now() / 1000) + data.expires_in) * 1000).toISOString()

  const del1 = await supabase.from('agency_token').delete().not('key', 'is', null)
  if (del1.error) return new NextResponse(`DB delete error (not null): ${del1.error.message}`, { status: 500 })
  const del2 = await supabase.from('agency_token').delete().is('key', null)
  if (del2.error) return new NextResponse(`DB delete error (is null): ${del2.error.message}`, { status: 500 })

  const ins = await supabase.from('agency_token').insert({
    key: 'agency',
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt
  })
  if (ins.error) return new NextResponse(`DB insert error: ${ins.error.message}`, { status: 500 })

  return new NextResponse('Tokens salvos com sucesso! Pode fechar esta aba.')
}


