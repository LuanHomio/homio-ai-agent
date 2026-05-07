import { NextRequest, NextResponse } from 'next/server';
import { ghlGet } from '@/lib/ghl-proxy';

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('locationId');
  if (!locationId) {
    return NextResponse.json({ error: 'Missing locationId' }, { status: 400 });
  }

  const result = await ghlGet<{ calendars?: Array<{ id: string; name: string; description?: string; isActive?: boolean }> }>(
    locationId,
    `/calendars/?locationId=${encodeURIComponent(locationId)}`,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const calendars = (result.data.calendars ?? []).map((c) => ({
    id: c.id,
    label: c.name,
    sublabel: c.description,
  }));

  return NextResponse.json({ items: calendars });
}
