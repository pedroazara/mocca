import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente do servidor com a sessão de quem está logado (painel). Respeita RLS.
export async function supabaseServidor() {
  const loja = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => loja.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) loja.set(name, value, options);
        } catch {
          // chamado de um Server Component: o middleware renova a sessão
        }
      },
    },
  });
}
