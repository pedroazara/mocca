// Testa as migrações e o RLS num Postgres embutido (PGlite), simulando o que o
// Supabase oferece: esquema auth, auth.uid(), auth.role() e os papéis anon,
// authenticated e service_role. Não substitui o teste no Supabase real (README).

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  SQL_ATRIBUICAO,
  SQL_AVISOS_PENDENTES,
  SQL_LEMBRETES,
  SQL_PACOTE,
  SQL_SEMANA_PACOTE,
  SQL_SITUACAO_PACOTE,
} from "@/lib/email/mensagens";
import { SQL_LIGAR_CONTA } from "@/lib/login";
import { SQL_MOVER_PARA_SEMANA } from "@/lib/painel/mover";

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

// uma conta que aparece em auth.users (por exemplo, um cadastro direto no Supabase)
const novoLogin = async (email: string) =>
  (await um<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email]))!.id;

// o primeiro acesso pelo painel: cria a conta e liga à pessoa (criarSenha)
const primeiroAcesso = async (email: string) => {
  const id = await novoLogin(email);
  await db.query(SQL_LIGAR_CONTA, [id, email.toLowerCase()]);
  return id;
};

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

  it("conta que aparece sozinha em auth.users não ganha acesso; só o primeiro acesso liga", async () => {
    // alguém se cadastra direto no Supabase com o e-mail do Marcos: nada é ligado
    const intruso = await novoLogin("marcos.ferreira@exemplo.com");
    expect((await um<{ auth_id: string | null }>("select auth_id from pessoa where apelido = 'Marcos'"))!.auth_id).toBeNull();
    await como({ usuario: intruso }, async () => {
      expect((await um<{ n: number }>("select count(*)::int n from tarefa"))!.n).toBe(0);
    });
    // pessoa desativada não é ligada nem no primeiro acesso
    await db.query("update pessoa set ativo = false where apelido = 'Henrique'");
    const henrique = await novoLogin("henrique.perez@exemplo.com");
    expect((await db.query(SQL_LIGAR_CONTA, [henrique, "henrique.perez@exemplo.com"])).rows).toHaveLength(0);
    await db.query("update pessoa set ativo = true where apelido = 'Henrique'");
    // cadastrar alguém cujo e-mail já tem conta também não liga
    await novoLogin("novo.membro@exemplo.com");
    const [novo] = (
      await db.query<{ auth_id: string | null }>(
        "insert into pessoa (nome, email, cor) values ('Novo Membro', 'novo.membro@exemplo.com', '#3F6B4A') returning auth_id",
      )
    ).rows;
    expect(novo.auth_id).toBeNull();
    await db.query("delete from pessoa where email = 'novo.membro@exemplo.com'");
  });

  it("trocar o e-mail da pessoa desliga a conta antiga", async () => {
    const conta = await primeiroAcesso("marcos.ferreira@exemplo.com");
    expect(conta).toBeTruthy();
    await db.query("update pessoa set email = 'marcos.novo@exemplo.com' where apelido = 'Marcos'");
    expect((await um<{ auth_id: string | null }>("select auth_id from pessoa where apelido = 'Marcos'"))!.auth_id).toBeNull();
    await db.query("update pessoa set email = 'marcos.ferreira@exemplo.com' where apelido = 'Marcos'");
  });

  it("liga o primeiro acesso à pessoa e registra o histórico de quem age", async () => {
    const pedro = await primeiroAcesso("Pedro.Henrique@exemplo.com");
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
        semana: null,
        etiquetas: [],
        outros: [],
      });

      // semana, etiquetas e quem mais está na tarefa, responsáveis primeiro
      const s3 = (await um<{ id: string }>("select id from semana where numero = 3"))!;
      await db.query("update tarefa set semana_id = $2 where id = $1", [t.id, s3.id]);
      await db.query("insert into tarefa_etiqueta select $1, id from etiqueta where nome = 'Marketing'", [t.id]);
      await db.query(
        `insert into atribuicao (tarefa_id, pessoa_id, papel)
         select $1, id, (case when apelido = 'Pedro' then 'responsavel' else 'apoio' end)::papel_atrib
           from pessoa where apelido in ('Marcos', 'Pedro')`,
        [t.id],
      );
      expect(await um(SQL_ATRIBUICAO, [t.id, gab.id])).toMatchObject({
        semana: { numero: 3, total: 12 },
        etiquetas: [{ nome: "Marketing", token: "et-marketing" }],
        outros: [
          { apelido: "Pedro", papel: "responsavel" },
          { apelido: "Marcos", papel: "apoio" },
        ],
      });
      await db.query("update tarefa set semana_id = null where id = $1", [t.id]);
      await db.query("delete from tarefa_etiqueta where tarefa_id = $1", [t.id]);
      await db.query("delete from atribuicao where tarefa_id = $1 and pessoa_id <> $2", [t.id, gab.id]);

      await db.query("update pessoa set ativo = false where id = $1", [gab.id]);
      expect(await um(SQL_ATRIBUICAO, [t.id, gab.id])).toBeUndefined();
      await db.query("update pessoa set ativo = true where id = $1", [gab.id]);
    });
  });

  it("orientador lê e comenta, mas não edita, e ninguém apaga histórico", async () => {
    const leomar = await primeiroAcesso("leomar.santos@exemplo.com");
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
    const gabriel = await primeiroAcesso("gabriel.leonardo@exemplo.com");
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

  it("proposta do Claude: só o admin lê e decide, e ninguém logado cria ou apaga", async () => {
    const { id } = (await um<{ id: string }>(
      "insert into proposta (operacao, dados) values ('criar_tarefa', '{\"titulo\":\"x\"}') returning id",
    ))!;
    const auth = (email: string) => um<{ id: string }>("select auth_id as id from pessoa where email = $1", [email]);
    const contar = () => um<{ n: number }>("select count(*)::int n from proposta");
    const criar = () => db.query("insert into proposta (operacao, dados) values ('comentar', '{}')");

    for (const email of ["gabriel.leonardo@exemplo.com", "leomar.santos@exemplo.com"])
      await como({ usuario: (await auth(email))!.id }, async () => {
        expect((await contar())!.n).toBe(0);
        expect((await db.query("update proposta set status = 'aprovada' where id = $1", [id])).affectedRows).toBe(0);
        await expect(criar()).rejects.toThrow();
      });

    await como({ usuario: (await auth("pedro.henrique@exemplo.com"))!.id }, async () => {
      expect((await contar())!.n).toBe(1);
      await expect(criar()).rejects.toThrow();
      await expect(db.query("delete from proposta where id = $1", [id])).rejects.toThrow();
      expect((await db.query("update proposta set status = 'recusada' where id = $1", [id])).affectedRows).toBe(1);
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

describe("passar tarefa de semana", () => {
  const criar = (prazo: string | null) =>
    um<{ id: string }>(
      "insert into tarefa (titulo, semana_id, prazo) values ('Passar', (select id from semana where numero = 3), $1) returning id",
      [prazo],
    );
  const mover = (id: string, numero: number) => um<{ id: string; prazo: string | null }>(SQL_MOVER_PARA_SEMANA, [id, numero]);
  const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);

  it("leva o prazo junto quando ele caía na semana antiga, e o histórico registra a troca", async () => {
    await como("service_role", async () => {
      // semana 3 vai de 03/11 a 09/11; o prazo é o fim da semana, 23:59 de Brasília
      const t = (await criar("2026-11-09T23:59:00-03:00"))!;
      expect(iso((await mover(t.id, 4))!.prazo)).toBe("2026-11-17T02:59:00.000Z"); // 16/11, 23:59
      // e volta para trás do mesmo jeito
      expect(iso((await mover(t.id, 2))!.prazo)).toBe("2026-11-03T02:59:00.000Z"); // 02/11, 23:59
      const h = (
        await db.query<{ detalhe: { de: number; para: number } }>(
          "select detalhe from historico where tarefa_id = $1 and acao = 'semana' order by id",
          [t.id],
        )
      ).rows.map((r) => r.detalhe);
      expect(h).toEqual([
        { de: 3, para: 4 },
        { de: 4, para: 2 },
      ]);
    });
  });

  it("não mexe no prazo fora da semana antiga nem cria prazo", async () => {
    await como("service_role", async () => {
      const longe = (await criar("2026-11-30T12:00:00-03:00"))!;
      expect(iso((await mover(longe.id, 5))!.prazo)).toBe("2026-11-30T15:00:00.000Z");
      const sem = (await criar(null))!;
      expect((await mover(sem.id, 5))!.prazo).toBeNull();
      expect(await mover(sem.id, 13)).toBeUndefined();
    });
  });

  it("com semanas de tamanhos diferentes (datas mudadas pelo admin), o prazo fica dentro da semana nova", async () => {
    await como("service_role", async () => {
      const datas = (await db.query<{ numero: number; inicio: string; fim: string }>(
        "select numero, inicio::text, fim::text from semana where numero in (3, 4) order by numero",
      )).rows;
      try {
        // semana 3 esticada até quarta, 11/11; semana 4 de quinta 12/11 a quarta 18/11
        await db.query("update semana set fim = '2026-11-11' where numero = 3");
        await db.query("update semana set inicio = '2026-11-12', fim = '2026-11-18' where numero = 4");
        const sexta = (await criar("2026-11-06T18:00:00-03:00"))!;
        expect(iso((await mover(sexta.id, 4))!.prazo)).toBe("2026-11-13T21:00:00.000Z"); // sexta 13/11, 18:00
        const fim = (await criar("2026-11-11T23:59:00-03:00"))!;
        expect(iso((await mover(fim.id, 4))!.prazo)).toBe("2026-11-19T02:59:00.000Z"); // fim da semana 4: 18/11
        // terça e quarta existem na semana 4: não viram a quinta 12/11
        const terca = (await criar("2026-11-03T18:00:00-03:00"))!;
        expect(iso((await mover(terca.id, 4))!.prazo)).toBe("2026-11-17T21:00:00.000Z"); // terça 17/11, 18:00
        const quarta = (await criar("2026-11-04T18:00:00-03:00"))!;
        expect(iso((await mover(quarta.id, 4))!.prazo)).toBe("2026-11-18T21:00:00.000Z"); // quarta 18/11, 18:00
        // semanas de 7 dias com dois dias de folga entre elas (03/11 a 09/11 e 12/11 a 18/11)
        await db.query("update semana set fim = '2026-11-09' where numero = 3");
        const outraTerca = (await criar("2026-11-03T18:00:00-03:00"))!;
        expect(iso((await mover(outraTerca.id, 4))!.prazo)).toBe("2026-11-17T21:00:00.000Z"); // terça 17/11
        const quinta = (await criar("2026-11-05T18:00:00-03:00"))!;
        expect(iso((await mover(quinta.id, 4))!.prazo)).toBe("2026-11-12T21:00:00.000Z"); // quinta 12/11
        expect(iso((await mover(quinta.id, 3))!.prazo)).toBe("2026-11-05T21:00:00.000Z"); // e de volta, quinta 05/11
        // semana 4 curta, de 10/11 a 13/11 (terça a sexta): o prazo não passa do fim dela
        await db.query("update semana set inicio = '2026-11-10', fim = '2026-11-13' where numero = 4");
        const fimDa3 = (await criar("2026-11-09T23:59:00-03:00"))!;
        expect(iso((await mover(fimDa3.id, 4))!.prazo)).toBe("2026-11-14T02:59:00.000Z"); // 13/11, 23:59
        const tercaCurta = (await criar("2026-11-03T09:00:00-03:00"))!;
        expect(iso((await mover(tercaCurta.id, 4))!.prazo)).toBe("2026-11-10T12:00:00.000Z"); // terça 10/11, 09:00
        // sábado não existe nela: fica na ponta mais perto, a sexta 13/11
        const sabado = (await criar("2026-11-07T12:00:00-03:00"))!;
        expect(iso((await mover(sabado.id, 4))!.prazo)).toBe("2026-11-13T15:00:00.000Z"); // 13/11, 12:00
      } finally {
        for (const d of datas) await db.query("update semana set inicio = $2, fim = $3 where numero = $1", [d.numero, d.inicio, d.fim]);
      }
    });
  });

  it("orientador vê a tarefa, mas não passa de semana", async () => {
    // o login do orientador já foi ligado à pessoa num teste anterior
    const leomar = (await um<{ auth_id: string }>("select auth_id from pessoa where apelido = 'Leomar'"))!.auth_id;
    expect(leomar).toBeTruthy();
    const t = (await como("service_role", () => criar(null)))!;
    await como({ usuario: leomar }, async () => {
      expect(await um("select id from tarefa where id = $1", [t.id])).toBeDefined();
      expect(await mover(t.id, 4)).toBeUndefined();
    });
  });
});

describe("lembrete da véspera", () => {
  it("lista as tarefas abertas do dia, por pessoa ativa, só com os itens abertos", async () => {
    await como("service_role", async () => {
      const gab = (await um<{ id: string }>("select id from pessoa where apelido = 'Gabriel'"))!.id;
      const nova = async (titulo: string, prazo: string, status = "a_fazer", arquivada = false) => {
        const t = (await um<{ id: string }>(
          "insert into tarefa (titulo, prazo, status, arquivada) values ($1, $2, $3::status_tarefa, $4) returning id",
          [titulo, prazo, status, arquivada],
        ))!.id;
        return (await um<{ id: string }>("insert into atribuicao (tarefa_id, pessoa_id) values ($1, $2) returning id", [t, gab]))!.id;
      };
      const a = await nova("Vence amanhã", "2026-11-10T23:59:00-03:00");
      await db.query("insert into item (atribuicao_id, texto, feito, posicao) values ($1, 'Feito', true, 1), ($1, 'Aberto', false, 2)", [a]);
      // ficam de fora: já feita, arquivada e a do dia seguinte
      await nova("Já feita", "2026-11-10T12:00:00-03:00", "feito");
      await nova("Arquivada", "2026-11-10T12:00:00-03:00", "a_fazer", true);
      await nova("Depois", "2026-11-11T00:30:00-03:00");
      const linhas = (await db.query<{ titulo: string; itens: string[]; nome: string }>(SQL_LEMBRETES, ["2026-11-10"])).rows;
      expect(linhas.map((l) => [l.nome, l.titulo, l.itens])).toEqual([["Gabriel", "Vence amanhã", ["Aberto"]]]);
    });
  });
});

describe("e-mails enviados", () => {
  it("o pacote da entrega: quem entra, os itens abertos e quem ainda falta receber", async () => {
    await como("service_role", async () => {
      const id = async (apelido: string) => (await um<{ id: string }>("select id from pessoa where apelido = $1", [apelido]))!.id;
      const [gab, marcos, henrique] = [await id("Gabriel"), await id("Marcos"), await id("Henrique")];
      const s5 = (await um<{ id: string }>("select id from semana where numero = 5"))!.id;
      const nova = async (titulo: string, ligada: boolean, status = "a_fazer") =>
        (await um<{ id: string }>(
          "insert into tarefa (titulo, semana_id, ligada_entrega, status, prazo) values ($1, $2, $3, $4::status_tarefa, '2026-11-20T23:59:00-03:00') returning id",
          [titulo, s5, ligada, status],
        ))!.id;
      const atribuir = async (tarefa: string, pessoa: string, papel = "apoio") =>
        (await um<{ id: string }>("insert into atribuicao (tarefa_id, pessoa_id, papel) values ($1, $2, $3::papel_atrib) returning id", [
          tarefa,
          pessoa,
          papel,
        ]))!.id;
      // os e-mails do seed são de exemplo: o do Gabriel vira real só aqui
      await db.query("update pessoa set email = 'gabriel@ufla.test' where id = $1", [gab]);
      try {
        const pitch = await nova("Pitch", true);
        const a = await atribuir(pitch, gab, "responsavel");
        await atribuir(pitch, marcos);
        await atribuir(pitch, henrique);
        await db.query("insert into item (atribuicao_id, texto, feito, posicao) values ($1, 'Feito', true, 1), ($1, 'Aberto', false, 2)", [a]);
        // ficam de fora do pacote: a feita e a que não é da entrega
        await atribuir(await nova("Já feita", true, "feito"), gab);
        const avulsa = await nova("Post no Instagram", false);
        await atribuir(avulsa, gab);

        const linhas = (await db.query<{ nome: string; titulo: string; itens: string[]; outros: { apelido: string }[] }>(SQL_PACOTE, [s5])).rows;
        expect(linhas.map((l) => [l.nome, l.titulo])).toEqual([
          ["Gabriel", "Pitch"],
          ["Henrique", "Pitch"],
          ["Marcos", "Pitch"],
        ]);
        expect(linhas[0].itens).toEqual(["Aberto"]);
        expect(linhas[0].outros.map((o) => o.apelido)).toEqual(["Henrique", "Marcos"]);
        expect(await um(SQL_SEMANA_PACOTE, [s5])).toMatchObject({ numero: 5, total: 12 });

        const situacao = async () =>
          Object.fromEntries(
            (await db.query<{ nome: string; tem_email: boolean; falta: boolean; enviado_em: string | null }>(SQL_SITUACAO_PACOTE, [s5])).rows.map(
              (r) => [r.nome, [r.tem_email, r.falta, Boolean(r.enviado_em)]],
            ),
          );
        expect(await situacao()).toEqual({ Gabriel: [true, true, false], Henrique: [false, true, false], Marcos: [false, true, false] });

        // depois do pacote, só volta a faltar quando entra uma tarefa nova
        await db.query("insert into email_enviado (tipo, pessoa_id, semana_id, tarefas) values ('entrega', $1, $2, array[$3::uuid])", [gab, s5, pitch]);
        expect((await situacao()).Gabriel).toEqual([true, false, true]);
        await atribuir(await nova("Roadmap", true), gab);
        expect((await situacao()).Gabriel).toEqual([true, true, true]);

        // o aviso da tarefa avulsa: falta até ser registrado; a da entrega diz que é
        expect((await db.query(SQL_AVISOS_PENDENTES, [avulsa])).rows).toEqual([{ pessoa_id: gab, nome: "Gabriel" }]);
        await db.query("insert into email_enviado (tipo, pessoa_id, tarefa_id) values ('tarefa', $1, $2)", [gab, avulsa]);
        expect((await db.query(SQL_AVISOS_PENDENTES, [avulsa])).rows).toEqual([]);
        expect(await um(SQL_ATRIBUICAO, [pitch, gab])).toMatchObject({ ligada_entrega: true });
        expect(await um(SQL_ATRIBUICAO, [avulsa, gab])).toMatchObject({ ligada_entrega: false });
      } finally {
        await db.query("update pessoa set email = 'gabriel.leonardo@exemplo.com' where id = $1", [gab]);
      }
    });
  });

  it("a equipe lê o registro, mas só o servidor grava", async () => {
    const login = (await um<{ auth_id: string; id: string }>(
      "select auth_id, id from pessoa where auth_id is not null and ativo and papel <> 'orientador' limit 1",
    ))!;
    await como({ usuario: login.auth_id }, async () => {
      expect((await um<{ n: number }>("select count(*)::int n from email_enviado"))!.n).toBeGreaterThan(0);
      await expect(
        db.query("insert into email_enviado (tipo, pessoa_id, tarefa_id) select 'tarefa', $1, id from tarefa limit 1", [login.id]),
      ).rejects.toThrow();
    });
    await como("anon", async () => {
      await expect(db.query("select * from email_enviado")).rejects.toThrow();
    });
  });
});
