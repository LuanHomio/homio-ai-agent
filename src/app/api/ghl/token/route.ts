import { NextRequest, NextResponse } from 'next/server';
import { getLocationAccessTokenDetails } from '@/lib/ghl';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');
  const appTokenFromQuery = searchParams.get('appToken');
  if (!locationId) return NextResponse.json({ error: 'locationId is required' }, { status: 400 });

  try {
    const auth = request.headers.get('authorization');
    const bearer = appTokenFromQuery || auth?.replace(/^Bearer\s+/i, '');
    const details = await getLocationAccessTokenDetails(locationId, bearer);
    console.log('[GHL] locationToken status:', details.status, 'raw:', details.raw);
    return NextResponse.json({ access_token: details.token, status: details.status, raw: details.raw });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'token error' }, { status: 500 });
  }
}


