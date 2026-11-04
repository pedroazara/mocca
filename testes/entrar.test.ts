// Testa as ações do login (app/entrar/acoes.ts) com as migrações de verdade num
// Postgres embutido (PGlite). Só o Next e o Supabase Auth são simulados: o
// createUser grava em auth.users, como o Supabase faz.

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contaQueSobrou } from "@/lib/login";

const raiz = join(__dirname, "..");

const sim = vi.hoisted(() => ({
  db: null as unknown as import("@electric-sql/pglite").PGlite,
  signIn: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }),
  cookies: async () => ({ set() {}, delete() {} }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/auth", () => ({ COOKIE_LOCAL: "mocca_local" }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServidor: async () => ({ auth: { signInWithPassword: sim.signIn } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ auth: { admin: { createUser: sim.createUser, deleteUser: sim.deleteUser } } }),
}));
vi.mock("@/lib/banco", () => ({
  modoLocal: false,
  modoLocalPermitido: false,
  comoServico: <T>(fn: (q: (sql: string, p?: unknown[]) => Promise<unknown[]>) => Promise<T>) =>
    sim.db.transaction(async (tx) => {
      await tx.exec("set local role service_role");
      return fn(async (sql, p = []) => (await tx.query(sql, p)).rows);
    }),
}));

const { criarSenha, entrarComSenha } = await import("@/app/entrar/acoes");

async function novoBanco(ate = "99999999999999") {
  const db = new PGlite();
  await db.exec(readFileSync(join(raiz, "supabase/local/auth-stub.sql"), "utf8"));
  for (const m of readdirSync(join(raiz, "supabase/migrations")).sort())
    if (m < ate) await db.exec(readFileSync(join(raiz, "supabase/migrations", m), "utf8"));
  await db.exec(readFileSync(join(raiz, "supabase/seed.sql"), "utf8"));
  return db;
}

const um = async <T>(sql: string, p: unknown[] = []) => (await sim.db.query<T>(sql, p)).rows[0];

// o createUser do Supabase: grava a conta e devolve o id
const criaConta = async ({ email }: { email: string }) => {
  const u = await um<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email]);
  return { data: { user: { id: u!.id } }, error: null };
};
const erroAuth = (code: string) => ({ data: { user: null }, error: { name: "AuthApiError", status: 422, code, message: code } });
const senhaErrada = { error: { message: "Invalid login credentials", code: "invalid_credentials" } };

let avisos: ReturnType<typeof vi.spyOn>;
let erros: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  sim.signIn.mockReset();
  sim.createUser.mockReset();
  sim.deleteUser.mockReset();
  avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
  erros = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("primeiro acesso (criarSenha)", () => {
  beforeEach(async () => {
    sim.db = await novoBanco();
  });

  it("cria a conta, liga à pessoa pelo id e entra", async () => {
    sim.createUser.mockImplementation(criaConta);
    sim.signIn.mockResolvedValue({ error: null });
    await expect(criarSenha("Marcos.Ferreira@exemplo.com", "senha-boa-123", "/painel/quadro")).rejects.toThrow(
      "REDIRECT:/painel/quadro",
    );
    const p = await um<{ auth_id: string | null }>("select auth_id from pessoa where apelido = 'Marcos'");
    const u = await um<{ id: string }>("select id from auth.users where email = 'marcos.ferreira@exemplo.com'");
    expect(p?.auth_id).toBe(u?.id);
  });

  it("com uma conta solta do mesmo e-mail, pede ao admin para apagá-la (em vez de 'Tente de novo' para sempre)", async () => {
    sim.createUser.mockResolvedValue(erroAuth("email_exists"));
    const r = await criarSenha("marcos.ferreira@exemplo.com", "senha-boa-123", "/painel");
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/não está ligada à equipe.*Authentication › Users/);
    expect(avisos).toHaveBeenCalled();
  });

  it("senha recusada pelo Supabase por ser fraca: diz o motivo", async () => {
    sim.createUser.mockResolvedValue(erroAuth("weak_password"));
    expect((await criarSenha("marcos.ferreira@exemplo.com", "12345678", "/painel")).erro).toMatch(/fraca/);
  });

  it("se a ligação falhar, apaga a conta nova e registra quando nem isso dá certo", async () => {
    // a pessoa foi desativada no meio do caminho: a ligação não acha ninguém
    sim.createUser.mockImplementation(async (d: { email: string }) => {
      await sim.db.query("update pessoa set ativo = false where apelido = 'Marcos'");
      return criaConta(d);
    });
    sim.deleteUser.mockResolvedValue({ data: null, error: { message: "falhou" } });
    const r = await criarSenha("marcos.ferreira@exemplo.com", "senha-boa-123", "/painel");
    expect(r.erro).toMatch(/Fale com o admin/);
    expect(sim.deleteUser).toHaveBeenCalledTimes(1);
    expect(erros.mock.calls.some((c: unknown[]) => String(c[0]).includes("conta nova não apagada"))).toBe(true);
  });
});

describe("freio do login (entrarComSenha)", () => {
  beforeEach(async () => {
    sim.db = await novoBanco();
  });

  it("a 9ª senha errada seguida do mesmo e-mail é freada antes de ir ao Supabase", async () => {
    sim.signIn.mockResolvedValue(senhaErrada);
    for (let i = 0; i < 8; i++)
      expect((await entrarComSenha("gabriel.leonardo@exemplo.com", "x", "/painel")).erro).toBe("E-mail ou senha incorretos.");
    expect((await entrarComSenha("gabriel.leonardo@exemplo.com", "x", "/painel")).erro).toMatch(/Muitas tentativas/);
    expect(sim.signIn).toHaveBeenCalledTimes(8);
  });

  it("tentativas simultâneas também entram na conta", async () => {
    // o login de verdade é uma ida e volta pela rede até o Supabase
    sim.signIn.mockImplementation(() => new Promise((r) => setTimeout(() => r(senhaErrada), 30)));
    const r = await Promise.all(
      Array.from({ length: 20 }, () => entrarComSenha("gabriel.leonardo@exemplo.com", "x", "/painel")),
    );
    expect(sim.signIn).toHaveBeenCalledTimes(8);
    expect(r.filter((x) => /Muitas tentativas/.test(x.erro))).toHaveLength(12);
  });

  it("a senha certa não conta como tentativa e devolve as chances do e-mail", async () => {
    sim.signIn.mockResolvedValue(senhaErrada);
    for (let i = 0; i < 3; i++) await entrarComSenha("gabriel.leonardo@exemplo.com", "x", "/painel");
    sim.signIn.mockResolvedValue({ error: null });
    await expect(entrarComSenha("gabriel.leonardo@exemplo.com", "certa", "/painel")).rejects.toThrow("REDIRECT:/painel");
    const n = await um<{ email: number; ip: number }>(
      `select count(*) filter (where chave like 'email:%')::int email, count(*) filter (where chave like 'ip:%')::int ip
         from tentativa_login`,
    );
    expect(n).toEqual({ email: 0, ip: 3 });
  });

  it("sem a tabela (migração ainda não aplicada), o login segue sem freio", async () => {
    sim.db = await novoBanco("20261104150000");
    sim.signIn.mockResolvedValue(senhaErrada);
    for (let i = 0; i < 10; i++) await entrarComSenha("gabriel.leonardo@exemplo.com", "x", "/painel");
    expect(sim.signIn).toHaveBeenCalledTimes(10);
    sim.signIn.mockResolvedValue({ error: null });
    await expect(entrarComSenha("gabriel.leonardo@exemplo.com", "certa", "/painel")).rejects.toThrow("REDIRECT:/painel");
  });
});

describe("troca de e-mail na Equipe", () => {
  beforeEach(async () => {
    sim.db = await novoBanco();
    sim.createUser.mockImplementation(criaConta);
    sim.signIn.mockResolvedValue({ error: null });
    await criarSenha("gabriel.leonardo@exemplo.com", "senha-boa-123", "/painel").catch(() => undefined);
  });

  const gabriel = () => um<{ email: string; auth_id: string | null }>("select email, auth_id from pessoa where apelido = 'Gabriel'");

  it("só maiúsculas e minúsculas diferentes não desligam a conta", async () => {
    const antes = await gabriel();
    await sim.db.query("update pessoa set email = 'Gabriel.Leonardo@exemplo.com' where apelido = 'Gabriel'");
    const depois = await gabriel();
    expect(depois?.auth_id).toBe(antes?.auth_id);
    expect(contaQueSobrou(antes, depois!)).toBeNull();
  });

  it("e-mail novo desliga a conta, que é apagada; voltar ao e-mail antigo cai no primeiro acesso, que funciona", async () => {
    const antes = await gabriel();
    await sim.db.query("update pessoa set email = 'gabriel.novo@exemplo.com' where apelido = 'Gabriel'");
    const depois = await gabriel();
    expect(depois?.auth_id).toBeNull();
    expect(contaQueSobrou(antes, depois!)).toBe(antes?.auth_id);
    // o que atualizarPessoa faz em seguida no Supabase: apagar a conta antiga
    await sim.db.query("delete from auth.users where id = $1", [antes?.auth_id]);
    await sim.db.query("update pessoa set email = 'gabriel.leonardo@exemplo.com' where apelido = 'Gabriel'");
    await expect(criarSenha("gabriel.leonardo@exemplo.com", "outra-senha-123", "/painel")).rejects.toThrow("REDIRECT:/painel");
    expect((await gabriel())?.auth_id).not.toBeNull();
  });
});
