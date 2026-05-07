import { NextRequest, NextResponse } from 'next/server';
import { ghlGet, ghlPost } from '@/lib/ghl-proxy';

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('locationId');
  if (!locationId) {
    return NextResponse.json({ error: 'Missing locationId' }, { status: 400 });
  }

  const result = await ghlGet<{ tags?: Array<{ id: string; name: string }> }>(
    locationId,
    `/locations/${locationId}/tags`,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const tags = (result.data.tags ?? []).map((t) => ({
    id: t.id,
    label: t.name,
    name: t.name,
  }));

  return NextResponse.json({ items: tags });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { locationId, name } = body as { locationId?: string; name?: string };

  if (!locationId) {
    return NextResponse.json({ error: 'Missing locationId' }, { status: 400 });
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Missing or invalid name' }, { status: 400 });
  }

  const result = await ghlPost<{ tag?: { id: string; name: string } }>(
    locationId,
    `/locations/${locationId}/tags`,
    { name: name.trim() },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const tag = result.data.tag;
  if (!tag) {
    return NextResponse.json({ error: 'Unexpected GHL response' }, { status: 500 });
  }

  return NextResponse.json({ id: tag.id, label: tag.name, name: tag.name });
}
