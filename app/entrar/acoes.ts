"use server";

import { createHmac } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_LOCAL } from "@/lib/auth";
import { comoServico, modoLocal, modoLocalPermitido } from "@/lib/banco";
import { esquemaEmail, esquemaSenhaNova, SENHA_MINIMA, SQL_LIGAR_CONTA } from "@/lib/login";
import { chaveDoIp, ipDaRequisicao } from "@/lib/rede/ip";
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

// Freio do login (DUVIDAS 29): o Supabase só vê o IP do servidor, então as
// tentativas erradas são contadas aqui, por e-mail e por IP (em hash).
const LIMITE_POR_EMAIL = 8;
const LIMITE_POR_IP = 30;

async function chavesDaTentativa(email: string) {
  const ip = ipDaRequisicao(await headers());
  const hash = ip
    ? createHmac("sha256", process.env.TURNSTILE_SECRET_KEY ?? "desenvolvimento").update(chaveDoIp(ip)).digest("hex").slice(0, 32)
    : null;
  return [`email:${email}`, ...(hash ? [`ip:${hash}`] : [])];
}

// Sem a tabela (migração 20261104150000 ainda não aplicada), o login segue sem
// freio, com um aviso no log: nunca trancar a equipe do lado de fora.
async function semFreio<T>(fn: () => Promise<T>, padrao: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.warn("[login] freio de tentativas indisponível:", e instanceof Error ? e.message : e);
    return padrao;
  }
}

// A tentativa é contada antes de ir ao Supabase, numa transação só, com uma
// trava por chave (como no formulário de contato, DUVIDAS 28): tentativas
// simultâneas do mesmo e-mail ou IP esperam a vez, e todas entram na conta.
// Devolve os ids da tentativa, ou null quando o login está freado.
const reservar = (chaves: string[]) =>
  semFreio<string[] | null>(
    () =>
      comoServico(async (q) => {
        for (const chave of [...chaves].sort())
          await q("select pg_advisory_xact_lock(hashtextextended($1, 0))", [chave]);
        const [r] = await q<{ email: number; ip: number }>(
          `select count(*) filter (where chave like 'email:%')::int as email,
                  count(*) filter (where chave like 'ip:%')::int as ip
             from tentativa_login
            where chave = any($1::text[]) and criado_em > now() - interval '15 minutes'`,
          [chaves],
        );
        if ((r?.email ?? 0) >= LIMITE_POR_EMAIL || (r?.ip ?? 0) >= LIMITE_POR_IP) return null;
        await q("delete from tentativa_login where criado_em < now() - interval '1 day'");
        const linhas = await q<{ id: string }>(
          "insert into tentativa_login (chave) select unnest($1::text[]) returning id::text as id",
          [chaves],
        );
        return linhas.map((l) => l.id);
      }),
    [],
  );

// Senha certa: esta tentativa não conta, e o e-mail volta a ter todas as chances.
const liberar = (ids: string[], email: string) =>
  semFreio(
    () =>
      comoServico((q) =>
        q("delete from tentativa_login where id = any($1::bigint[]) or chave = $2", [ids, `email:${email}`]),
      ),
    [],
  );

export async function entrarComSenha(emailBruto: string, senha: string, volta: string): Promise<Resposta> {
  const email = esquemaEmail.safeParse(emailBruto);
  if (!email.success) return { ok: false, erro: "Digite um e-mail válido." };
  const tentativa = await reservar(await chavesDaTentativa(email.data));
  if (!tentativa) return { ok: false, erro: "Muitas tentativas erradas. Espere 15 minutos e tente de novo." };
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: senha });
  if (error) return { ok: false, erro: "E-mail ou senha incorretos." };
  await liberar(tentativa, email.data);
  redirect(destinoSeguro(volta));
}

// Primeiro acesso: cria a conta com a senha escolhida e liga a conta à pessoa,
// pelo id da conta criada (DUVIDAS 27). Se a ligação falhar (a pessoa foi
// desativada ou outra conta chegou antes), a conta nova é apagada. Se já existe
// uma conta solta com este e-mail, só o admin resolve, e a pessoa fica sabendo.
export async function criarSenha(emailBruto: string, senha: string, volta: string): Promise<Resposta> {
  const email = esquemaEmail.safeParse(emailBruto);
  if (!email.success) return { ok: false, erro: "Digite um e-mail válido." };
  const senhaNova = esquemaSenhaNova.safeParse(senha);
  if (!senhaNova.success) return { ok: false, erro: `A senha precisa ter de ${SENHA_MINIMA} a 72 caracteres.` };

  const pessoa = await buscarPessoa(email.data);
  if (!pessoa) return { ok: false, erro: "Este e-mail não está cadastrado na equipe." };
  if (pessoa.auth_id) return { ok: false, erro: "Este e-mail já tem senha. Volte e entre com ela." };

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: email.data,
    password: senhaNova.data,
    email_confirm: true,
  });
  if (error?.code === "email_exists" || error?.code === "user_already_exists") {
    console.warn("[login] primeiro acesso: já existe uma conta de login solta com o e-mail", email.data);
    return {
      ok: false,
      erro: "Este e-mail já tem uma conta de login que não está ligada à equipe. Peça ao admin para apagá-la no Supabase (Authentication › Users) e crie a senha de novo.",
    };
  }
  if (error?.code === "weak_password") {
    return { ok: false, erro: "O login recusou esta senha por ser fraca. Escolha outra, misturando letras e números." };
  }
  if (error || !data.user) {
    console.error("[login] criar conta:", error?.code ?? "", error?.message ?? "sem usuário");
    return { ok: false, erro: "Não conseguimos criar a conta. Tente de novo." };
  }
  const ligada = await comoServico((q) => q(SQL_LIGAR_CONTA, [data.user.id, email.data])).catch((e) => {
    console.error("[login] ligar conta:", e instanceof Error ? e.message : e);
    return [];
  });
  if (!ligada.length) {
    // o deleteUser devolve o erro em vez de lançar
    const apagada = await admin.auth.admin.deleteUser(data.user.id).catch((e: Error) => ({ error: e }));
    if (apagada.error) console.error("[login] conta nova não apagada:", data.user.id, apagada.error.message);
    return { ok: false, erro: "Não conseguimos criar a conta. Fale com o admin da equipe." };
  }

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
