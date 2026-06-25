import { NextRequest, NextResponse } from 'next/server';
import { ghlGet } from '@/lib/ghl-proxy';
import { requireLocation } from '@/lib/authz';

export async function GET(request: NextRequest) {
  const auth = await requireLocation(request);
  if (auth instanceof NextResponse) return auth;
  const locationId = auth.ghlLocationId;

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
