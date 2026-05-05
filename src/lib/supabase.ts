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

