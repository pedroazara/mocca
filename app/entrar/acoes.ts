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

const freado = (chaves: string[]) =>
  semFreio(async () => {
    const [r] = await comoServico((q) =>
      q<{ email: number; ip: number }>(
        `select count(*) filter (where chave like 'email:%')::int as email,
                count(*) filter (where chave like 'ip:%')::int as ip
           from tentativa_login
          where chave = any($1::text[]) and criado_em > now() - interval '15 minutes'`,
        [chaves],
      ),
    );
    return (r?.email ?? 0) >= LIMITE_POR_EMAIL || (r?.ip ?? 0) >= LIMITE_POR_IP;
  }, false);

const anotarErro = (chaves: string[]) =>
  semFreio(
    () =>
      comoServico(async (q) => {
        await q("insert into tentativa_login (chave) select unnest($1::text[])", [chaves]);
        await q("delete from tentativa_login where criado_em < now() - interval '1 day'");
      }),
    undefined,
  );

const esquecerErros = (email: string) =>
  semFreio(() => comoServico((q) => q("delete from tentativa_login where chave = $1", [`email:${email}`])), []);

export async function entrarComSenha(emailBruto: string, senha: string, volta: string): Promise<Resposta> {
  const email = esquemaEmail.safeParse(emailBruto);
  if (!email.success) return { ok: false, erro: "Digite um e-mail válido." };
  const chaves = await chavesDaTentativa(email.data);
  if (await freado(chaves)) {
    return { ok: false, erro: "Muitas tentativas erradas. Espere 15 minutos e tente de novo." };
  }
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: senha });
  if (error) {
    await anotarErro(chaves);
    return { ok: false, erro: "E-mail ou senha incorretos." };
  }
  await esquecerErros(email.data);
  redirect(destinoSeguro(volta));
}

// Primeiro acesso: cria a conta com a senha escolhida e liga a conta à pessoa,
// pelo id da conta criada (DUVIDAS 27). Se a ligação falhar (a pessoa foi
// desativada ou outra conta chegou antes), a conta nova é apagada.
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
  if (error || !data.user) return { ok: false, erro: "Não conseguimos criar a conta. Tente de novo." };
  const ligada = await comoServico((q) => q(SQL_LIGAR_CONTA, [data.user.id, email.data])).catch(() => []);
  if (!ligada.length) {
    await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
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
