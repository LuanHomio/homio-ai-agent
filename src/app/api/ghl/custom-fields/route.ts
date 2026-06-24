import { NextRequest, NextResponse } from 'next/server';
import { ghlGet } from '@/lib/ghl-proxy';
import { requireLocation } from '@/lib/authz';

export async function GET(request: NextRequest) {
  const auth = await requireLocation(request);
  if (auth instanceof NextResponse) return auth;
  const locationId = auth.ghlLocationId;
  const model = request.nextUrl.searchParams.get('model') || 'contact';

  const result = await ghlGet<{
    customFields?: Array<{ id: string; name: string; fieldKey?: string; dataType?: string }>;
  }>(locationId, `/locations/${locationId}/customFields?model=${encodeURIComponent(model)}`);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const fields = (result.data.customFields ?? []).map((f) => ({
    id: f.id,
    label: f.name,
    sublabel: f.dataType,
    dataType: f.dataType,
    fieldKey: f.fieldKey,
  }));

  return NextResponse.json({ items: fields });
}
