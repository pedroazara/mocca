// Testa as ações do login (app/entrar/acoes.ts) e a troca de e-mail na Equipe
// (atualizarPessoa) com as migrações de verdade num Postgres embutido (PGlite).
// Só o Next e o Supabase Auth são simulados: o createUser grava em auth.users e
// recusa um e-mail que já tem conta, e o deleteUser apaga, como o Supabase faz.

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const raiz = join(__dirname, "..");

const sim = vi.hoisted(() => ({
  db: null as unknown as import("@electric-sql/pglite").PGlite,
  signIn: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  eu: vi.fn(),
  // comoServico em conexões separadas (ver o mock de @/lib/banco)
  conexoes: false,
  // o IP de cada requisição
  ip: (): string => "203.0.113.7",
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": sim.ip() }),
  cookies: async () => ({ set() {}, delete() {} }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({ avisarAtribuicao: vi.fn() }));
vi.mock("@/lib/auth", () => ({ COOKIE_LOCAL: "mocca_local", pessoaLogada: sim.eu }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServidor: async () => ({ auth: { signInWithPassword: sim.signIn } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ auth: { admin: { createUser: sim.createUser, deleteUser: sim.deleteUser } } }),
}));
vi.mock("@/lib/banco", () => {
  type Q = (sql: string, p?: unknown[]) => Promise<unknown[]>;
  const naTransacao = <T>(claims: object, papel: string, fn: (q: Q) => Promise<T>) =>
    sim.db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      await tx.exec(`set local role ${papel}`);
      return fn(async (sql, p = []) => (await tx.query(sql, p)).rows);
    });
  // Na produção, cada chamada tem a sua conexão (o pooler), e chamadas
  // simultâneas se intercalam. O PGlite tem uma conexão só e faria uma esperar
  // a outra de qualquer jeito, e aí a trava nunca seria posta à prova. Aqui cada
  // comando vai sozinho, e a trava exclusiva do Postgres (pg_advisory_xact_lock)
  // vira uma fila por chave, solta quando a "transação" acaba. Outras formas,
  // como a _shared, rodam no PGlite e não seguram ninguém, como na produção.
  const filas = new Map<string, Promise<void>>();
  const emConexoes = async <T>(fn: (q: Q) => Promise<T>) => {
    const soltar: (() => void)[] = [];
    try {
      return await fn(async (sql, p = []) => {
        if (!/\bpg_advisory_xact_lock\s*\(/i.test(sql)) return (await sim.db.query(sql, p)).rows;
        const chave = String(p[0]);
        const antes = filas.get(chave) ?? Promise.resolve();
        let solta = () => {};
        filas.set(chave, antes.then(() => new Promise<void>((r) => (solta = r))));
        await antes;
        soltar.push(solta);
        return [];
      });
    } finally {
      soltar.forEach((s) => s());
    }
  };
  return {
    modoLocal: false,
    modoLocalPermitido: false,
    mensagemDeErro: (e: unknown) => String(e),
    comoUsuario: <T>(authId: string, fn: (q: Q) => Promise<T>) =>
      naTransacao({ sub: authId, role: "authenticated" }, "authenticated", fn),
    comoServico: <T>(fn: (q: Q) => Promise<T>) =>
      sim.conexoes ? emConexoes(fn) : naTransacao({ role: "service_role" }, "service_role", fn),
  };
});

const { criarSenha, entrarComSenha } = await import("@/app/entrar/acoes");
const { atualizarPessoa } = await import("@/app/painel/acoes");

async function novoBanco(ate = "99999999999999") {
  const db = new PGlite();
  await db.exec(readFileSync(join(raiz, "supabase/local/auth-stub.sql"), "utf8"));
  for (const m of readdirSync(join(raiz, "supabase/migrations")).sort())
    if (m < ate) await db.exec(readFileSync(join(raiz, "supabase/migrations", m), "utf8"));
  await db.exec(readFileSync(join(raiz, "supabase/seed.sql"), "utf8"));
  return db;
}

const um = async <T>(sql: string, p: unknown[] = []) => (await sim.db.query<T>(sql, p)).rows[0];

const erroAuth = (code: string) => ({ data: { user: null }, error: { name: "AuthApiError", status: 422, code, message: code } });
// o createUser do Supabase: um e-mail, uma conta; grava a conta e devolve o id
const criaConta = async ({ email }: { email: string }) => {
  if (await um("select 1 from auth.users where lower(email) = lower($1)", [email])) return erroAuth("email_exists");
  const u = await um<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email]);
  return { data: { user: { id: u!.id } }, error: null };
};
const senhaErrada = { error: { message: "Invalid login credentials", code: "invalid_credentials" } };

let avisos: ReturnType<typeof vi.spyOn>;
let erros: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  sim.signIn.mockReset();
  sim.createUser.mockReset();
  sim.deleteUser.mockReset();
  sim.conexoes = false;
  sim.ip = () => "203.0.113.7";
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

  describe("tentativas simultâneas também entram na conta", () => {
    beforeEach(() => {
      sim.conexoes = true;
      // o login de verdade é uma ida e volta pela rede até o Supabase
      sim.signIn.mockImplementation(() => new Promise((r) => setTimeout(() => r(senhaErrada), 30)));
    });
    const freadas = (r: { erro: string }[]) => r.filter((x) => /Muitas tentativas/.test(x.erro)).length;

    it("do mesmo e-mail e IP", async () => {
      const r = await Promise.all(
        Array.from({ length: 20 }, () => entrarComSenha("gabriel.leonardo@exemplo.com", "x", "/painel")),
      );
      expect(sim.signIn).toHaveBeenCalledTimes(8);
      expect(freadas(r)).toBe(12);
    });

    it("de muitos e-mails no mesmo IP: vale o limite do IP", async () => {
      const r = await Promise.all(
        Array.from({ length: 40 }, (_, i) => entrarComSenha(`pessoa${i}@exemplo.com`, "x", "/painel")),
      );
      expect(sim.signIn).toHaveBeenCalledTimes(30);
      expect(freadas(r)).toBe(10);
    });

    it("do mesmo e-mail em muitos IPs: vale o limite do e-mail", async () => {
      let n = 0;
      sim.ip = () => `198.51.100.${++n}`;
      const r = await Promise.all(
        Array.from({ length: 20 }, () => entrarComSenha("gabriel.leonardo@exemplo.com", "x", "/painel")),
      );
      expect(sim.signIn).toHaveBeenCalledTimes(8);
      expect(freadas(r)).toBe(12);
    });
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

describe("troca de e-mail na Equipe (atualizarPessoa)", () => {
  type Dados = { id: string; nome: string; apelido: string; email: string; frente: string; papel: "membro"; cor: string };
  let gabriel: Dados;
  beforeEach(async () => {
    sim.db = await novoBanco();
    // o admin logado
    const conta = await um<{ id: string }>("insert into auth.users (email) values ('pedro.henrique@exemplo.com') returning id");
    const admin = await um<{ id: string }>("update pessoa set auth_id = $1 where papel = 'admin' returning id", [conta!.id]);
    sim.eu.mockResolvedValue({ id: admin!.id, authId: conta!.id, papel: "admin" });
    // o Gabriel já criou a senha
    sim.createUser.mockImplementation(criaConta);
    sim.signIn.mockResolvedValue({ error: null });
    await criarSenha("gabriel.leonardo@exemplo.com", "senha-boa-123", "/painel").catch(() => undefined);
    // o deleteUser do Supabase apaga a conta
    sim.deleteUser.mockImplementation(async (id: string) => {
      await sim.db.query("delete from auth.users where id = $1", [id]);
      return { data: null, error: null };
    });
    gabriel = (await um<Dados>(
      "select id, nome, apelido, email, frente, papel::text as papel, cor from pessoa where apelido = 'Gabriel'",
    ))!;
  });

  const ligacao = async () => (await um<{ email: string; auth_id: string | null }>("select email, auth_id from pessoa where id = $1", [gabriel.id]))!;

  it("salvar sem trocar o e-mail, ou trocando só maiúsculas e minúsculas, não mexe na conta", async () => {
    const { auth_id } = await ligacao();
    expect(auth_id).not.toBeNull();
    expect((await atualizarPessoa(gabriel.id, gabriel)).ok).toBe(true);
    await sim.db.query("update pessoa set email = 'Gabriel.Leonardo@exemplo.com' where id = $1", [gabriel.id]);
    expect((await atualizarPessoa(gabriel.id, gabriel)).ok).toBe(true); // salva em minúsculas
    expect(await ligacao()).toEqual({ email: "gabriel.leonardo@exemplo.com", auth_id });
    expect(sim.deleteUser).not.toHaveBeenCalled();
  });

  it("e-mail novo apaga a conta antiga; de volta ao e-mail antigo, o primeiro acesso funciona", async () => {
    const antiga = (await ligacao()).auth_id;
    expect((await atualizarPessoa(gabriel.id, { ...gabriel, email: "gabriel.novo@exemplo.com" })).ok).toBe(true);
    expect(sim.deleteUser.mock.calls).toEqual([[antiga]]);
    expect((await ligacao()).auth_id).toBeNull();
    expect((await atualizarPessoa(gabriel.id, gabriel)).ok).toBe(true);
    expect(sim.deleteUser).toHaveBeenCalledTimes(1);
    // sem a conta antiga solta, o createUser não esbarra nela
    await expect(criarSenha("gabriel.leonardo@exemplo.com", "outra-senha-123", "/painel")).rejects.toThrow("REDIRECT:/painel");
    expect((await ligacao()).auth_id).not.toBeNull();
  });

  it("se a conta antiga não puder ser apagada (até sem a chave), o salvar vale e o erro vai para o log", async () => {
    // sem a chave, o cliente do Supabase lança antes de devolver a promessa
    sim.deleteUser.mockImplementation(() => {
      throw new Error("supabaseKey is required.");
    });
    expect((await atualizarPessoa(gabriel.id, { ...gabriel, email: "gabriel.novo@exemplo.com" })).ok).toBe(true);
    expect(await ligacao()).toEqual({ email: "gabriel.novo@exemplo.com", auth_id: null });
    expect(erros.mock.calls.some((c: unknown[]) => String(c[0]).includes("conta antiga não apagada"))).toBe(true);
  });

  it("se o salvar falhar no meio, nada muda e a conta antiga fica", async () => {
    const antes = await ligacao();
    await sim.db.exec(`
      create function falhar() returns trigger language plpgsql as $$ begin raise exception 'falhou'; end $$;
      create trigger falhar before insert or update on perfil_publico for each row execute function falhar();`);
    expect((await atualizarPessoa(gabriel.id, { ...gabriel, email: "gabriel.novo@exemplo.com" })).ok).toBe(false);
    expect(sim.deleteUser).not.toHaveBeenCalled();
    expect(await ligacao()).toEqual(antes);
  });
});
