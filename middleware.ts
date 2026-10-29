import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Guarda do painel (seção 3.2): sem sessão, /painel/* vai para /entrar?volta=...
// Quem está na sessão mas não faz parte da equipe é barrado no layout do painel
// (a checagem precisa do banco). A API /api/v1 usa token, não sessão.

const COOKIE_LOCAL = "mocca-local-sessao";

export async function middleware(req: NextRequest) {
  let resposta = NextResponse.next({ request: req });
  let logado = false;

  if (!process.env.DATABASE_URL) {
    logado = Boolean(req.cookies.get(COOKIE_LOCAL)?.value);
  } else {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (lista) => {
            for (const { name, value } of lista) req.cookies.set(name, value);
            resposta = NextResponse.next({ request: req });
            for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
          },
        },
      },
    );
    const { data } = await supabase.auth.getUser();
    logado = Boolean(data.user);
  }

  if (!logado && req.nextUrl.pathname.startsWith("/painel")) {
    const destino = req.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = `?volta=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(destino);
  }
  return resposta;
}

export const config = {
  matcher: ["/painel/:caminho*", "/entrar", "/acesso-negado"],
};
