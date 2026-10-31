import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente com a chave service_role: só para criar a conta no primeiro acesso.
export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
