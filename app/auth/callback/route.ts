import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

// Volta do login Google: troca o código pela sessão e segue para o painel.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const codigo = url.searchParams.get("code");
  const volta = url.searchParams.get("volta");
  const destino = volta?.startsWith("/painel") ? volta : "/painel";
  if (codigo) {
    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }
  return NextResponse.redirect(new URL("/entrar", url.origin));
}
