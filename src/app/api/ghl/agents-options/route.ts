import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireLocation } from '@/lib/authz';

/**
 * Lista agents do Homio AI Agent na mesma subconta (location), normalizado
 * pra dropdown de transferToBot. Nao chama GHL — le do Supabase.
 *
 * Path debaixo de /api/ghl/* so pra reusar o mesmo padrao de useGhlOptions
 * ({ items: [{ id, label, sublabel }] }).
 */
export async function GET(request: NextRequest) {
  const auth = await requireLocation(request);
  if (auth instanceof NextResponse) {
    if (auth.status === 403) return NextResponse.json({ items: [] }); // unregistered → none
    return auth;
  }
  const exclude = request.nextUrl.searchParams.get('exclude');

  let query = supabase
    .from('agents')
    .select('id, name, description, is_active')
    .eq('location_id', auth.locationUuid)
    .order('name', { ascending: true });

  if (exclude) query = query.neq('id', exclude);

  const { data: agents, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (agents ?? []).map((a) => ({
    id: a.id,
    label: a.name,
    sublabel: a.is_active ? 'Ativo' : 'Inativo',
  }));

  return NextResponse.json({ items });
}
