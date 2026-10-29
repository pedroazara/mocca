import { createBrowserClient } from "@supabase/ssr";

// Cliente do navegador (painel). Respeita RLS.
export function supabaseNavegador() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
