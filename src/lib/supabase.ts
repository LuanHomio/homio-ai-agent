import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE!;

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
} as const;

export const supabase = createClient(supabaseUrl, supabaseServiceKey, clientOptions);

// Typed client — usar em codigo novo. Migracao gradual do `supabase` legacy
// vai acontecer em PRs separados conforme bugs latentes forem endereçados.
// Ver wiki/projetos/homio_ai_agent.md secao "Pendente — migracao typed client".
export const supabaseTyped = createClient<Database>(supabaseUrl, supabaseServiceKey, clientOptions);

// supabase-js sempre manda `Range: 0-999`, entao um .from().select() sem
// .limit()/.range() trunca em 1000 linhas sem erro. Use pageAll() pra listagens
// onde o volume pode crescer alem de 1000 e o consumidor precisa de tudo.
const DEFAULT_PAGE_SIZE = 1000;

export async function pageAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await build(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

