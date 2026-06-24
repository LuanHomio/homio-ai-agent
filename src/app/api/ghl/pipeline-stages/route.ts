import { NextRequest, NextResponse } from 'next/server';
import { ghlGet } from '@/lib/ghl-proxy';
import { requireLocation } from '@/lib/authz';

type GhlPipeline = {
  id: string;
  name: string;
  stages?: Array<{ id: string; name: string; position?: number }>;
};

export async function GET(request: NextRequest) {
  const auth = await requireLocation(request);
  if (auth instanceof NextResponse) return auth;
  const locationId = auth.ghlLocationId;
  const pipelineId = request.nextUrl.searchParams.get('pipelineId');
  if (!pipelineId) {
    return NextResponse.json({ items: [] });
  }

  const result = await ghlGet<{ pipelines?: GhlPipeline[] }>(
    locationId,
    `/opportunities/pipelines/?locationId=${encodeURIComponent(locationId)}`,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const pipeline = result.data.pipelines?.find((p) => p.id === pipelineId);
  const items = (pipeline?.stages ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((s) => ({ id: s.id, label: s.name }));

  return NextResponse.json({ items });
}
