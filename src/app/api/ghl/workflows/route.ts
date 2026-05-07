import { NextRequest, NextResponse } from 'next/server';
import { ghlGet } from '@/lib/ghl-proxy';

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('locationId');
  if (!locationId) {
    return NextResponse.json({ error: 'Missing locationId' }, { status: 400 });
  }

  const result = await ghlGet<{ workflows?: Array<{ id: string; name: string; status?: string }> }>(
    locationId,
    `/workflows/?locationId=${encodeURIComponent(locationId)}`,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const workflows = (result.data.workflows ?? []).map((w) => ({
    id: w.id,
    label: w.name,
    sublabel: w.status,
  }));

  return NextResponse.json({ items: workflows });
}
