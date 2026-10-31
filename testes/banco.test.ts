// Testa as migrações e o RLS num Postgres embutido (PGlite), simulando o que o
// Supabase oferece: esquema auth, auth.uid(), auth.role() e os papéis anon,
// authenticated e service_role. Não substitui o teste no Supabase real (README).

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { SQL_ATRIBUICAO } from "@/lib/email/mensagens";

const raiz = join(__dirname, "..");
const db = new PGlite();

const um = async <T = Record<string, unknown>>(sql: string, params?: unknown[]) =>
  (await db.query<T>(sql, params)).rows[0];

async function como<T>(papel: "anon" | "service_role" | { usuario: string }, fn: () => Promise<T>) {
  if (papel === "anon") await db.exec("set role anon");
  else if (papel === "service_role")
    await db.exec("set role service_role; set request.jwt.claim.role = 'service_role';");
  else
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub = '${papel.usuario}'; set request.jwt.claim.role = 'authenticated';`,
    );
  try {
    return await fn();
  } finally {
    await db.exec("reset role; reset request.jwt.claim.sub; reset request.jwt.claim.role;");
  }
}

const novoLogin = async (email: string) =>
  (await um<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email]))!.id;

const contato = {
  nome: "Maria Teste",
  email: "Maria@Exemplo.com",
  telefone: "35999998888",
  perfil: "produtor",
  cidade_uf: "Lavras, MG",
  area_ha: 25.5,
  tipo_colheita: "Mecanizada",
  mensagem: "Quero participar dos testes de campo.",
  consentiu: true,
};

const registrar = (dados: object, ipHash: string) =>
  como("service_role", () => um<{ id: string }>("select registrar_contato($1::jsonb, $2) id", [JSON.stringify(dados), ipHash]));

let tabelas: string[] = [];

beforeAll(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role', true), '') $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);
  const pasta = join(raiz, "supabase", "migrations");
  for (const f of readdirSync(pasta).sort()) await db.exec(readFileSync(join(pasta, f), "utf8"));
  const seed = readFileSync(join(raiz, "supabase", "seed.sql"), "utf8");
  await db.exec(seed);
  await db.exec(seed); // o seed pode rodar de novo sem duplicar
  tabelas = (await db.query<{ t: string }>("select tablename t from pg_tables where schemaname = 'public'")).rows.map(
    (r) => r.t,
  );
});

describe("seed", () => {
  it("cria pessoas, etiquetas e as 12 semanas", async () => {
    expect((await um<{ n: number }>("select count(*)::int n from pessoa"))!.n).toBe(6);
    expect((await um<{ n: number }>("select count(*)::int n from etiqueta"))!.n).toBe(5);
    expect((await um<{ n: number }>("select count(*)::int n from semana"))!.n).toBe(12);
    const s2 = await um<{ i: string; f: string }>(
      "select to_char(inicio,'DD/MM') i, to_char(fim,'DD/MM') f from semana where numero = 2",
    );
    expect(s2).toEqual({ i: "27/10", f: "02/11" });
  });
});

describe("contato do site (registrar_contato)", () => {
  it("grava o contato e cria a tarefa atribuída ao responsável", async () => {
    const { id } = (await registrar(contato, "ip-a"))!;
    const c = await um<{ email: string }>("select email from contato where id = $1", [id]);
    expect(c!.email).toBe("maria@exemplo.com");
    const t = await um<{ id: string; titulo: string; origem: string }>(
      "select id, titulo, origem from tarefa where contato_id = $1",
      [id],
    );
    expect(t).toMatchObject({ titulo: "Responder contato: Maria Teste", origem: "contato" });
    const a = await um<{ apelido: string; papel: string }>(
      "select p.apelido, a.papel from atribuicao a join pessoa p on p.id = a.pessoa_id where a.tarefa_id = $1",
      [t!.id],
    );
    expect(a).toEqual({ apelido: "Gabriel", papel: "responsavel" });
    const h = (await db.query<{ via_api: boolean }>("select via_api from historico where tarefa_id = $1", [t!.id])).rows;
    expect(h.length).toBeGreaterThan(0);
    expect(h.every((x) => x.via_api === false)).toBe(true);
  });

  it("limita a 5 envios por IP por hora", async () => {
    for (let i = 0; i < 5; i++) await registrar(contato, "ip-b");
    await expect(registrar(contato, "ip-b")).rejects.toThrow(/limite_de_envios/);
    await expect(registrar(contato, "ip-c")).resolves.toBeTruthy();
  });

  it("recusa envio sem consentimento", async () => {
    await expect(registrar({ ...contato, consentiu: false }, "ip-d")).rejects.toThrow(/sem_consentimento/);
  });
});

describe("RLS", () => {
  it("está ligado em todas as tabelas", async () => {
    const sem = await db.query(
      "select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity",
    );
    expect(sem.rows).toEqual([]);
  });

  it("anon não lê nenhuma tabela nem chama registrar_contato", async () => {
    await como("anon", async () => {
      for (const t of tabelas) await expect(db.query(`select 1 from ${t} limit 1`)).rejects.toThrow();
      await expect(db.query("select registrar_contato('{}'::jsonb, 'x')")).rejects.toThrow();
    });
  });

  it("e-mail fora da equipe não vê nada", async () => {
    const id = await novoLogin("estranho@gmail.com");
    await como({ usuario: id }, async () => {
      for (const t of tabelas) expect((await um<{ n: number }>(`select count(*)::int n from ${t}`))!.n).toBe(0);
    });
  });

  it("liga o primeiro login à pessoa pelo e-mail e registra o histórico de quem age", async () => {
    const pedro = await novoLogin("Pedro.Henrique@exemplo.com");
    expect((await um<{ auth_id: string }>("select auth_id from pessoa where apelido = 'Pedro'"))!.auth_id).toBe(pedro);

    const acoes = await como({ usuario: pedro }, async () => {
      const eu = (await um<{ id: string }>("select id from eu()"))!;
      const t = (await um<{ id: string }>("insert into tarefa (titulo, criado_por) values ('Teste', $1) returning id", [eu.id]))!;
      const gab = (await um<{ id: string }>("select id from pessoa where apelido = 'Gabriel'"))!;
      const mar = (await um<{ id: string }>("select id from pessoa where apelido = 'Marcos'"))!;
      const a = (await um<{ id: string }>(
        "insert into atribuicao (tarefa_id, pessoa_id) values ($1, $2) returning id",
        [t.id, gab.id],
      ))!;
      await db.query("insert into atribuicao (tarefa_id, pessoa_id, papel) values ($1, $2, 'apoio')", [t.id, mar.id]);
      const it = (await um<{ id: string }>("insert into item (atribuicao_id, texto) values ($1, 'Agendar') returning id", [a.id]))!;
      await db.query("update item set feito = true where id = $1", [it.id]);
      await db.query("update tarefa set status = 'feito' where id = $1", [t.id]);
      expect((await um<{ ok: boolean }>("select concluido_em is not null ok from tarefa where id = $1", [t.id]))!.ok).toBe(true);
      return (
        await db.query<{ acao: string; meu: boolean }>(
          "select acao, autor_id = $2 meu from historico where tarefa_id = $1 order by id",
          [t.id, eu.id],
        )
      ).rows;
    });
    expect(acoes.map((a) => a.acao)).toEqual(["criou", "atribuiu", "atribuiu", "item_feito", "status"]);
    expect(acoes.every((a) => a.meu)).toBe(true);
  });

  it("o upsert de atribuição só marca como nova quem ainda não estava na tarefa", async () => {
    await como("service_role", async () => {
      const t = (await um<{ id: string }>("insert into tarefa (titulo) values ('Upsert') returning id"))!;
      const gab = (await um<{ id: string }>("select id from pessoa where apelido = 'Gabriel'"))!;
      const atribuir = (papel: string) =>
        um<{ id: string; nova: boolean }>(
          `insert into atribuicao (tarefa_id, pessoa_id, papel) values ($1, $2, $3::papel_atrib)
           on conflict (tarefa_id, pessoa_id) do update set papel = excluded.papel
           returning id, (xmax = 0) as nova`,
          [t.id, gab.id, papel],
        );
      const primeira = (await atribuir("responsavel"))!;
      expect(primeira.nova).toBe(true);
      expect((await atribuir("apoio"))!.nova).toBe(false);

      await db.query("insert into item (atribuicao_id, texto, posicao) values ($1, 'Segundo', 2), ($1, 'Primeiro', 1)", [primeira.id]);
      expect(await um(SQL_ATRIBUICAO, [t.id, gab.id])).toMatchObject({
        para: "gabriel.leonardo@exemplo.com",
        nome: "Gabriel",
        papel: "apoio",
        titulo: "Upsert",
        itens: ["Primeiro", "Segundo"],
      });

      await db.query("update pessoa set ativo = false where id = $1", [gab.id]);
      expect(await um(SQL_ATRIBUICAO, [t.id, gab.id])).toBeUndefined();
      await db.query("update pessoa set ativo = true where id = $1", [gab.id]);
    });
  });

  it("orientador lê e comenta, mas não edita, e ninguém apaga histórico", async () => {
    const leomar = await novoLogin("leomar.santos@exemplo.com");
    await como({ usuario: leomar }, async () => {
      expect((await um<{ n: number }>("select count(*)::int n from tarefa"))!.n).toBeGreaterThan(0);
      expect((await db.query("update tarefa set titulo = 'mudado'")).affectedRows).toBe(0);
      await expect(db.query("insert into tarefa (titulo) values ('x')")).rejects.toThrow();
      const eu = (await um<{ id: string }>("select id from eu()"))!;
      const t = (await um<{ id: string }>("select id from tarefa limit 1"))!;
      await db.query("insert into comentario (tarefa_id, autor_id, texto) values ($1, $2, 'ok')", [t.id, eu.id]);
      expect((await db.query("delete from historico")).affectedRows).toBe(0);
    });
  });

  it("membro não altera configuração nem pessoas; desativado perde acesso", async () => {
    const gabriel = await novoLogin("gabriel.leonardo@exemplo.com");
    await como({ usuario: gabriel }, async () => {
      expect((await db.query("update configuracao set reuniao_hora = '18:00'")).affectedRows).toBe(0);
      await expect(db.query("insert into pessoa (nome, email, cor) values ('X', 'x@x.com', '#000')")).rejects.toThrow();
      expect((await um<{ n: number }>("select count(*)::int n from token_api"))!.n).toBe(0);
    });
    await db.query("update pessoa set ativo = false where apelido = 'Gabriel'");
    await como({ usuario: gabriel }, async () => {
      expect((await um<{ n: number }>("select count(*)::int n from tarefa"))!.n).toBe(0);
    });
    await db.query("update pessoa set ativo = true where apelido = 'Gabriel'");
  });

  it("perfil público: todos leem, só o admin altera, e fica de fora o anônimo", async () => {
    const pessoaId = (await um<{ id: string }>("select id from pessoa where apelido = 'Gabriel'"))!.id;
    const gravar = (linkedin: string) =>
      db.query(
        `insert into perfil_publico (pessoa_id, linkedin, foto, foto_em) values ($1, $2, decode('/9j/', 'base64'), now())
         on conflict (pessoa_id) do update set linkedin = excluded.linkedin`,
        [pessoaId, linkedin],
      );

    const pedro = (await um<{ auth_id: string }>("select auth_id from pessoa where apelido = 'Pedro'"))!.auth_id;
    await como({ usuario: pedro }, () => gravar("https://www.linkedin.com/in/gabriel/"));

    const gabriel = (await um<{ auth_id: string }>("select auth_id from pessoa where apelido = 'Gabriel'"))!.auth_id;
    await como({ usuario: gabriel }, async () => {
      const linha = await um<{ linkedin: string }>("select linkedin from perfil_publico where pessoa_id = $1", [pessoaId]);
      expect(linha!.linkedin).toBe("https://www.linkedin.com/in/gabriel/");
      await expect(gravar("https://www.linkedin.com/in/outro/")).rejects.toThrow();
      expect((await db.query("update perfil_publico set foto = null")).affectedRows).toBe(0);
      expect((await db.query("delete from perfil_publico")).affectedRows).toBe(0);
    });

    await como("service_role", async () => {
      const [f] = (await db.query<{ foto: string }>("select encode(foto, 'base64') foto from perfil_publico")).rows;
      expect(f.foto).toBe("/9j/");
    });
  });

  it("perfil público só aceita links do LinkedIn", async () => {
    const pessoaId = (await um<{ id: string }>("select id from pessoa where apelido = 'Marcos'"))!.id;
    for (const url of ["javascript:alert(1)", "https://linkedin.com.exemplo.com/in/x", "http://linkedin.com/in/x"])
      await expect(db.query("insert into perfil_publico (pessoa_id, linkedin) values ($1, $2)", [pessoaId, url])).rejects.toThrow();
  });

  it("documento só aceita links do Google Drive e Docs", async () => {
    const t = (await um<{ id: string }>("select id from tarefa limit 1"))!;
    await expect(
      db.query("insert into documento (tarefa_id, titulo, url) values ($1, 'x', 'https://exemplo.com/a')", [t.id]),
    ).rejects.toThrow();
    await db.query(
      "insert into documento (tarefa_id, titulo, url) values ($1, 'Roteiro', 'https://docs.google.com/document/d/abc')",
      [t.id],
    );
  });
});
