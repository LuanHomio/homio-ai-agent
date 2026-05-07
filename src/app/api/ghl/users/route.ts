import { NextRequest, NextResponse } from 'next/server';
import { ghlGet } from '@/lib/ghl-proxy';

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('locationId');
  if (!locationId) {
    return NextResponse.json({ error: 'Missing locationId' }, { status: 400 });
  }

  const result = await ghlGet<{
    users?: Array<{ id: string; name?: string; firstName?: string; lastName?: string; email?: string }>;
  }>(locationId, `/users/?locationId=${encodeURIComponent(locationId)}`);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const users = (result.data.users ?? []).map((u) => {
    const fullName = u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id;
    return {
      id: u.id,
      label: fullName,
      sublabel: u.email,
    };
  });

  return NextResponse.json({ items: users });
}
