import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { comoUsuario, modoLocal } from "./banco";
import { supabaseServidor } from "./supabase/server";

// Sessão do painel (seção 7). Em produção: login Google do Supabase Auth.
// No modo local: um cookie com o id do "usuário" escolhido na tela de entrar.

export const COOKIE_LOCAL = "mocca-local-sessao";

export type Sessao = { authId: string; email: string | null };

export type PapelPainel = "admin" | "membro" | "orientador";

export type PessoaLogada = {
  id: string;
  authId: string;
  nome: string;
  apelido: string | null;
  email: string;
  papel: PapelPainel;
  cor: string;
  frente: string | null;
};

export const sessao = cache(async (): Promise<Sessao | null> => {
  if (modoLocal) {
    const id = (await cookies()).get(COOKIE_LOCAL)?.value;
    return id ? { authId: id, email: null } : null;
  }
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  return data.user ? { authId: data.user.id, email: data.user.email ?? null } : null;
});

// Pessoa da equipe ligada à sessão, ou null se o e-mail não está na equipe.
export const pessoaLogada = cache(async (): Promise<PessoaLogada | null> => {
  const s = await sessao();
  if (!s) return null;
  const [p] = await comoUsuario(s.authId, (q) =>
    q<Omit<PessoaLogada, "authId">>(
      "select id, nome, apelido, email, papel::text as papel, cor, frente from eu() where id is not null",
    ),
  );
  return p ? { ...p, authId: s.authId } : null;
});

// Para páginas e ações do painel: sem sessão vai para /entrar; fora da equipe,
// para /acesso-negado.
export async function exigirPessoa(volta = "/painel"): Promise<PessoaLogada> {
  const s = await sessao();
  if (!s) redirect(`/entrar?volta=${encodeURIComponent(volta)}`);
  const p = await pessoaLogada();
  if (!p) redirect("/acesso-negado");
  return p;
}

export const podeEditar = (p: PessoaLogada) => p.papel !== "orientador";
export const ehAdmin = (p: PessoaLogada) => p.papel === "admin";
