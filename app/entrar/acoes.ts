"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_LOCAL } from "@/lib/auth";
import { comoServico, modoLocal, modoLocalPermitido } from "@/lib/banco";
import { esquemaEmail, esquemaSenhaNova, SENHA_MINIMA } from "@/lib/login";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServidor } from "@/lib/supabase/server";

type Resposta = { ok: false; erro: string };

function destinoSeguro(volta: string | null | undefined) {
  return volta && volta.startsWith("/painel") ? volta : "/painel";
}

// Modo local: "entrar como" uma pessoa da equipe, sem senha.
export async function entrarLocal(formulario: FormData) {
  if (!modoLocal || !modoLocalPermitido) throw new Error("Só no modo local.");
  const authId = String(formulario.get("authId") ?? "");
  const [existe] = await comoServico((q) => q("select 1 from pessoa where auth_id = $1 and ativo", [authId]));
  if (!existe) throw new Error("Usuário local não encontrado.");
  (await cookies()).set(COOKIE_LOCAL, authId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(destinoSeguro(String(formulario.get("volta") ?? "")));
}

async function buscarPessoa(email: string) {
  const [pessoa] = await comoServico((q) =>
    q<{ auth_id: string | null }>("select auth_id from pessoa where lower(email) = $1 and ativo", [email]),
  );
  return pessoa ?? null;
}

// Primeira etapa: a pessoa está na equipe? Já criou a senha?
export async function verificarEmail(
  emailBruto: string,
): Promise<{ ok: true; etapa: "senha" | "criar" } | Resposta> {
  const email = esquemaEmail.safeParse(emailBruto);
  if (!email.success) return { ok: false, erro: "Digite um e-mail válido." };
  const pessoa = await buscarPessoa(email.data);
  if (!pessoa) return { ok: false, erro: "Este e-mail não está cadastrado na equipe." };
  return { ok: true, etapa: pessoa.auth_id ? "senha" : "criar" };
}

export async function entrarComSenha(emailBruto: string, senha: string, volta: string): Promise<Resposta> {
  const email = esquemaEmail.safeParse(emailBruto);
  if (!email.success) return { ok: false, erro: "Digite um e-mail válido." };
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: senha });
  if (error) return { ok: false, erro: "E-mail ou senha incorretos." };
  redirect(destinoSeguro(volta));
}

// Primeiro acesso: cria a conta com a senha escolhida. O gatilho
// ligar_pessoa_ao_usuario liga a conta à pessoa pelo e-mail.
export async function criarSenha(emailBruto: string, senha: string, volta: string): Promise<Resposta> {
  const email = esquemaEmail.safeParse(emailBruto);
  if (!email.success) return { ok: false, erro: "Digite um e-mail válido." };
  const senhaNova = esquemaSenhaNova.safeParse(senha);
  if (!senhaNova.success) return { ok: false, erro: `A senha precisa ter de ${SENHA_MINIMA} a 72 caracteres.` };

  const pessoa = await buscarPessoa(email.data);
  if (!pessoa) return { ok: false, erro: "Este e-mail não está cadastrado na equipe." };
  if (pessoa.auth_id) return { ok: false, erro: "Este e-mail já tem senha. Volte e entre com ela." };

  const { error } = await supabaseAdmin().auth.admin.createUser({
    email: email.data,
    password: senhaNova.data,
    email_confirm: true,
  });
  if (error) return { ok: false, erro: "Não conseguimos criar a conta. Tente de novo." };

  const supabase = await supabaseServidor();
  const entrada = await supabase.auth.signInWithPassword({ email: email.data, password: senhaNova.data });
  if (entrada.error) return { ok: false, erro: "Conta criada, mas o login falhou. Tente entrar com a senha." };
  redirect(destinoSeguro(volta));
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
