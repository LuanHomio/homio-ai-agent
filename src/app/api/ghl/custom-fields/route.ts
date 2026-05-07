import { NextRequest, NextResponse } from 'next/server';
import { ghlGet } from '@/lib/ghl-proxy';

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('locationId');
  const model = request.nextUrl.searchParams.get('model') || 'contact';
  if (!locationId) {
    return NextResponse.json({ error: 'Missing locationId' }, { status: 400 });
  }

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
