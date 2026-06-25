import { NextRequest, NextResponse } from 'next/server';
import { ghlGet } from '@/lib/ghl-proxy';
import { requireLocation } from '@/lib/authz';

export async function GET(request: NextRequest) {
  const auth = await requireLocation(request);
  if (auth instanceof NextResponse) return auth;
  const locationId = auth.ghlLocationId;

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
