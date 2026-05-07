import { NextRequest, NextResponse } from 'next/server';
import { ghlGet } from '@/lib/ghl-proxy';

type GhlPipeline = {
  id: string;
  name: string;
  stages?: Array<{ id: string; name: string; position?: number }>;
};

/**
 * Cache simples por request — o GHL retorna pipelines+stages no mesmo
 * endpoint, mas o frontend pede via 2 endpoints distintos pra usar com
 * GhlSelect (cleaner). Vale fazer 1 fetch a GHL por chamada — e a Vercel
 * faz seu proprio caching de fetch quando o response e identico.
 */
async function fetchPipelines(locationId: string) {
  return ghlGet<{ pipelines?: GhlPipeline[] }>(
    locationId,
    `/opportunities/pipelines/?locationId=${encodeURIComponent(locationId)}`,
  );
}

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('locationId');
  if (!locationId) {
    return NextResponse.json({ error: 'Missing locationId' }, { status: 400 });
  }

  const result = await fetchPipelines(locationId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const items = (result.data.pipelines ?? []).map((p) => ({
    id: p.id,
    label: p.name,
    sublabel: p.stages?.length ? `${p.stages.length} stages` : undefined,
  }));

  return NextResponse.json({ items });
}
