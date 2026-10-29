"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_LOCAL } from "@/lib/auth";
import { comoServico, modoLocal, modoLocalPermitido } from "@/lib/banco";
import { supabaseServidor } from "@/lib/supabase/server";

function destinoSeguro(volta: string | null | undefined) {
  return volta && volta.startsWith("/painel") ? volta : "/painel";
}

// Modo local: "entrar como" uma pessoa da equipe, sem Google.
export async function entrarLocal(formulario: FormData) {
  if (!modoLocal || !modoLocalPermitido) throw new Error("Só no modo local.");
  const authId = String(formulario.get("authId") ?? "");
  const [existe] = await comoServico((q) => q("select 1 from pessoa where auth_id = $1 and ativo", [authId]));
  if (!existe) throw new Error("Usuário local não encontrado.");
  (await cookies()).set(COOKIE_LOCAL, authId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(destinoSeguro(String(formulario.get("volta") ?? "")));
}

export async function sair() {
  if (modoLocal) {
    (await cookies()).delete(COOKIE_LOCAL);
  } else {
    const supabase = await supabaseServidor();
    await supabase.auth.signOut();
  }
  redirect("/entrar");
}
