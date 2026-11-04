// Aprovação do admin (seção 11.4): roda o serviço real da API num Postgres
// embutido com as migrações e o seed, no mesmo papel que a produção usa. Só o
// acesso ao banco e o e-mail são trocados por versões de teste.

import type { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const t = vi.hoisted(() => ({ db: null as unknown as import("@electric-sql/pglite").PGlite, avisar: vi.fn(), eu: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({ avisarAtribuicao: t.avisar }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ pessoaLogada: t.eu }));
vi.mock("@/lib/banco", () => ({
  mensagemDeErro: (e: unknown) => String(e),
  comoUsuario: vi.fn(),
  comoServico: (fn: (q: unknown) => Promise<unknown>) =>
    t.db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "service_role" })]);
      await tx.exec("set local role service_role");
      return fn(async (sql: string, params: unknown[] = []) => (await tx.query(sql, params)).rows);
    }),
}));

const api = await import("@/lib/api/servico");
const acoes = await import("@/app/painel/acoes");
const rota = await import("@/app/api/mcp/route");
const { comoServico } = await import("@/lib/banco");
const { propostasPendentes } = await import("@/lib/painel/dados");
const { resumirProposta } = await import("@/lib/painel/propostas");
const { PGlite: Banco } = await import("@electric-sql/pglite");

const pasta = join(__dirname, "..", "supabase");
const ler = (...p: string[]) => readFileSync(join(pasta, ...p), "utf8");
let db: PGlite;
let token: string;
let admin: string;

const um = async <L = Record<string, unknown>>(sql: string, params?: unknown[]) => (await db.query<L>(sql, params)).rows[0];
const contar = async (tabela: string, onde = "true", params?: unknown[]) =>
  (await um<{ n: number }>(`select count(*)::int n from ${tabela} where ${onde}`, params))!.n;
const proposta = (id: string) => um<Record<string, unknown>>("select * from proposta where id = $1", [id]);

const tarefaSimples = async (titulo: string) => {
  const r = await api.criarTarefa({ titulo, atribuicoes: [{ pessoa: "Gabriel", papel: "responsavel", itens: ["Primeiro item"] }] }, token);
  const a = await api.aprovarProposta(r.proposta_id, admin);
  return a.status === "aprovada" ? a.id : "";
};

beforeAll(async () => {
  db = t.db = new Banco();
  await db.exec(ler("local", "auth-stub.sql"));
  for (const f of readdirSync(join(pasta, "migrations")).sort()) await db.exec(ler("migrations", f));
  await db.exec(ler("seed.sql"));
  token = (await um<{ id: string }>("insert into token_api (nome, hash) values ('teste', 'x') returning id"))!.id;
  admin = (await um<{ id: string }>("select id from pessoa where papel = 'admin'"))!.id;
});

beforeEach(() => t.avisar.mockClear());

describe("pedido com token", () => {
  it("não grava nada no painel, nem avisa ninguém", async () => {
    const antes = await contar("tarefa");
    const r = await api.criarTarefa(
      { titulo: "Entrevistas", semana: 2, etiquetas: ["Técnico"], atribuicoes: [{ pessoa: "gabriel", papel: "responsavel", itens: ["Agendar"] }] },
      token,
    );
    expect(r).toMatchObject({ status: "pendente", tarefa_id: null });
    expect(r.link).toContain(`/painel/aprovacoes#proposta-${r.proposta_id}`);
    expect(await contar("tarefa")).toBe(antes);
    expect(t.avisar).not.toHaveBeenCalled();
  });

  it("guarda a pessoa pelo id, para valer o que o admin viu, e o token que pediu", async () => {
    const r = await api.criarTarefa({ titulo: "Com pessoa", atribuicoes: [{ pessoa: "Pinotti" }] }, token);
    const p = (await proposta(r.proposta_id))!;
    const pinotti = (await um<{ id: string }>("select id from pessoa where apelido = 'Pinotti'"))!.id;
    expect(p).toMatchObject({ status: "pendente", operacao: "criar_tarefa", token_id: token });
    expect((p.dados as { atribuicoes: { pessoa: string }[] }).atribuicoes[0].pessoa).toBe(pinotti);
  });

  it("recusa na hora o que não daria para aplicar, sem criar proposta", async () => {
    const id = await tarefaSimples("Para os erros");
    const antes = await contar("proposta");
    const fantasma = "00000000-0000-4000-8000-000000000000";
    const casos: [Promise<unknown>, string][] = [
      [api.criarTarefa({ titulo: "x", atribuicoes: [{ pessoa: "Ninguém" }] }, token), "pessoa_inexistente"],
      [api.criarTarefa({ titulo: "x", atribuicoes: [{ pessoa: "Gabriel" }, { pessoa: "gabriel.leonardo@exemplo.com" }] }, token), "pessoa_repetida"],
      [api.criarTarefa({ titulo: "x", etiquetas: ["Não existe"] }, token), "etiqueta_inexistente"],
      [api.criarTarefa({ titulo: "x", etiquetas: ["Técnico", "técnico"] }, token), "etiqueta_repetida"],
      [api.atualizarTarefa(id, { etiquetas: ["Técnico", "tecnico"] }, token), "etiqueta_repetida"],
      [api.atualizarTarefa(fantasma, { status: "feito" }, token), "tarefa_inexistente"],
      [api.atualizarTarefa(id, {}, token), "sem_mudancas"],
      [api.atualizarTarefa(id, { etiquetas: ["Não existe"] }, token), "etiqueta_inexistente"],
      [api.atribuir(id, { pessoa: "Ninguém" }, token), "pessoa_inexistente"],
      [api.removerAtribuicao(id, "Marcos", token), "atribuicao_inexistente"],
      [api.atualizarItem(fantasma, { feito: true }, token), "item_inexistente"],
      [api.comentar(fantasma, "oi", token), "tarefa_inexistente"],
    ];
    for (const [pedido, codigo] of casos) await expect(pedido).rejects.toMatchObject({ codigo });
    expect(await contar("proposta")).toBe(antes);
  });
});

describe("aprovar", () => {
  it("aplica como o Claude e avisa a pessoa só nesse momento", async () => {
    const r = await api.criarTarefa(
      {
        titulo: "Aprovada de ponta a ponta",
        semana: 3,
        origem: "reuniao",
        etiquetas: ["Técnico"],
        atribuicoes: [
          { pessoa: "Gabriel", papel: "responsavel", itens: ["Agendar", "Conduzir"] },
          { pessoa: "Marcos", papel: "apoio", itens: ["Preencher"] },
        ],
        documentos: [{ titulo: "Roteiro", url: "https://docs.google.com/document/d/abc" }],
      },
      token,
    );
    const a = await api.aprovarProposta(r.proposta_id, admin);
    if (a.status !== "aprovada") throw new Error(a.erro);

    expect(await um("select titulo, origem::text, prazo is not null as tem_prazo from tarefa where id = $1", [a.id])).toEqual({
      titulo: "Aprovada de ponta a ponta",
      origem: "reuniao",
      tem_prazo: true,
    });
    expect(await contar("atribuicao", "tarefa_id = $1", [a.id])).toBe(2);
    expect(await contar("item i join atribuicao x on x.id = i.atribuicao_id", "x.tarefa_id = $1", [a.id])).toBe(3);
    expect(await contar("documento", "tarefa_id = $1", [a.id])).toBe(1);
    expect(await contar("tarefa_etiqueta", "tarefa_id = $1", [a.id])).toBe(1);
    expect(await um("select via_api, autor_id from historico where tarefa_id = $1 and acao = 'criou'", [a.id])).toEqual({ via_api: true, autor_id: null });
    expect(t.avisar).toHaveBeenCalledTimes(2);

    expect(await proposta(r.proposta_id)).toMatchObject({ status: "aprovada", decidido_por: admin, tarefa_id: a.id, erro: null });
    expect((await proposta(r.proposta_id))!.decidido_em).not.toBeNull();
  });

  it("clique duplo não aplica duas vezes, mesmo ao mesmo tempo", async () => {
    const titulo = "Clique duplo";
    const r = await api.criarTarefa({ titulo }, token);
    const dois = await Promise.allSettled([api.aprovarProposta(r.proposta_id, admin), api.aprovarProposta(r.proposta_id, admin)]);
    expect(dois.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(dois.find((x) => x.status === "rejected")).toMatchObject({ reason: { codigo: "proposta_decidida" } });
    expect(await contar("tarefa", "titulo = $1", [titulo])).toBe(1);
    await expect(api.aprovarProposta(r.proposta_id, admin)).rejects.toMatchObject({ codigo: "proposta_decidida" });
    expect(await contar("tarefa", "titulo = $1", [titulo])).toBe(1);
  });

  it("proposta recusada não pode mais ser aprovada", async () => {
    const titulo = "Recusada";
    const r = await api.criarTarefa({ titulo }, token);
    await db.query("update proposta set status = 'recusada', decidido_por = $2, decidido_em = now() where id = $1", [r.proposta_id, admin]);
    await expect(api.aprovarProposta(r.proposta_id, admin)).rejects.toMatchObject({ codigo: "proposta_decidida" });
    expect(await contar("tarefa", "titulo = $1", [titulo])).toBe(0);
  });

  it("aplica cada tipo de escrita", async () => {
    const id = await tarefaSimples("Para as escritas");
    const item = (await um<{ id: string }>(
      "select i.id from item i join atribuicao a on a.id = i.atribuicao_id where a.tarefa_id = $1",
      [id],
    ))!.id;
    const aprovar = async (r: { proposta_id: string }) => expect(await api.aprovarProposta(r.proposta_id, admin)).toMatchObject({ status: "aprovada" });

    await aprovar(await api.atualizarTarefa(id, { status: "fazendo", semana: 4, etiquetas: ["Técnico", "Negócio"] }, token));
    expect(await um("select t.status::text, s.numero from tarefa t join semana s on s.id = t.semana_id where t.id = $1", [id])).toEqual({ status: "fazendo", numero: 4 });
    await aprovar(await api.atualizarTarefa(id, { etiquetas: ["Marketing"] }, token));
    expect(await contar("tarefa_etiqueta", "tarefa_id = $1", [id])).toBe(1);
    // trocar só a semana leva o prazo junto, como no painel (DUVIDAS 4m)
    await db.query("update tarefa set prazo = '2026-11-16T23:59:00-03:00' where id = $1", [id]); // fim da semana 4
    await aprovar(await api.atualizarTarefa(id, { semana: 5 }, token));
    expect(await um("select s.numero, t.prazo from tarefa t join semana s on s.id = t.semana_id where t.id = $1", [id])).toEqual({
      numero: 5,
      prazo: new Date("2026-11-24T02:59:00.000Z"),
    });
    await aprovar(await api.atualizarTarefa(id, { semana: null, prazo: null }, token));
    expect(await um("select semana_id, prazo from tarefa where id = $1", [id])).toEqual({ semana_id: null, prazo: null });

    await aprovar(await api.atualizarItem(item, { feito: true, texto: "Renomeado" }, token));
    expect(await um("select feito, texto from item where id = $1", [item])).toEqual({ feito: true, texto: "Renomeado" });

    await aprovar(await api.atribuir(id, { pessoa: "Marcos", itens: ["Da atribuição"] }, token));
    await aprovar(await api.adicionarItem(id, "Marcos", "Avulso", token));
    expect(await contar("item i join atribuicao a on a.id = i.atribuicao_id", "a.tarefa_id = $1", [id])).toBe(3);
    await aprovar(await api.removerAtribuicao(id, "Marcos", token));
    expect(await contar("atribuicao", "tarefa_id = $1", [id])).toBe(1);

    await aprovar(await api.adicionarDocumento(id, { titulo: "Ata", url: "https://drive.google.com/file/d/a" }, token));
    expect(await contar("documento", "tarefa_id = $1", [id])).toBe(1);
    await aprovar(await api.comentar(id, "Feito pelo Claude", token));
    expect(await um("select via_api, autor_id from comentario where tarefa_id = $1", [id])).toEqual({ via_api: true, autor_id: null });
  });

  it("marca como falhou, sem deixar nada pela metade, quando a pessoa saiu da equipe", async () => {
    const titulo = "Pessoa saiu";
    const r = await api.criarTarefa({ titulo, etiquetas: ["Técnico"], atribuicoes: [{ pessoa: "Henrique" }] }, token);
    await db.query("update pessoa set ativo = false where apelido = 'Henrique'");
    const a = await api.aprovarProposta(r.proposta_id, admin);
    await db.query("update pessoa set ativo = true where apelido = 'Henrique'");
    expect(a).toEqual({ status: "falhou", erro: "Essa pessoa não está mais ativa na equipe." });
    expect(await contar("tarefa", "titulo = $1", [titulo])).toBe(0);
    expect(await proposta(r.proposta_id)).toMatchObject({ status: "falhou", erro: a.status === "falhou" ? a.erro : "", decidido_por: admin });
    expect(t.avisar).not.toHaveBeenCalled();
  });

  it("erro inesperado não consome a proposta, que segue pendente para tentar de novo", async () => {
    const { id } = (await um<{ id: string }>("insert into proposta (operacao, dados) values ('criar_tarefa', '{}') returning id"))!;
    const erro = await api.aprovarProposta(id, admin).catch((e) => e);
    expect(erro).toBeInstanceOf(Error);
    expect(erro).not.toBeInstanceOf(api.ErroApi);
    expect(await proposta(id)).toMatchObject({ status: "pendente", erro: null, decidido_por: null });
    await db.query("delete from proposta where id = $1", [id]);
  });

  it("marca como falhou quando a tarefa sumiu antes da aprovação", async () => {
    const id = await tarefaSimples("Vai sumir");
    const r = await api.comentar(id, "Tarde demais", token);
    await db.query("delete from tarefa where id = $1", [id]);
    expect(await api.aprovarProposta(r.proposta_id, admin)).toEqual({ status: "falhou", erro: "Tarefa não encontrada." });
    expect(await proposta(r.proposta_id)).toMatchObject({ status: "falhou", tarefa_id: null });
  });
});

describe("consulta da tela de aprovações", () => {
  it("traz o que o admin precisa comparar, e o resumo funciona com ela", async () => {
    const id = await tarefaSimples("Para a tela");
    const item = (await um<{ id: string }>(
      "select i.id from item i join atribuicao a on a.id = i.atribuicao_id where a.tarefa_id = $1",
      [id],
    ))!.id;
    // id em maiúsculas: o token não pode esconder da tela qual item muda
    const marcar = await api.atualizarItem(item.toUpperCase(), { feito: true }, token);
    const tirar = await api.removerAtribuicao(id, "Gabriel", token);
    const fora = await api.adicionarItem(id, "Marcos", "Novo", token);
    const alterar = await api.atualizarTarefa(id, { status: "feito", prazo: "2027-01-02T12:00:00-03:00" }, token);

    const lista = await comoServico((q) => propostasPendentes(q));
    const de = (r: { proposta_id: string }) => lista.find((p) => p.id === r.proposta_id)!;

    expect(de(marcar)).toMatchObject({ item_texto: "Primeiro item", dados: { item_id: item }, token_nome: "teste", tarefa_titulo: "Para a tela" });
    expect(de(tirar)).toMatchObject({ papel_atual: "responsavel", itens_da_pessoa: [{ texto: "Primeiro item", feito: false }] });
    expect(de(fora)).toMatchObject({ papel_atual: null, itens_da_pessoa: null });
    expect(de(alterar).atual).toMatchObject({ titulo: "Para a tela", status: "a_fazer", prazo: null, semana: null, etiquetas: [], ligada_entrega: false });
    expect(lista.map((p) => p.criado_em)).toEqual([...lista.map((p) => p.criado_em)].sort());

    for (const p of lista) expect(resumirProposta(p, () => "Alguém").titulo).toBeTruthy();
    expect(resumirProposta(de(alterar), () => "Alguém").linhas).toContainEqual({ rotulo: "Prazo", atual: "sem prazo", proposto: "02/01/2027 às 12:00" });
  });
});

describe("ação de aprovar no painel", () => {
  it("só o admin aprova, porque o service role ignora o RLS", async () => {
    const titulo = "Só o admin";
    const r = await api.criarTarefa({ titulo }, token);
    for (const eu of [null, { id: admin, papel: "membro" }, { id: admin, papel: "orientador" }]) {
      t.eu.mockResolvedValueOnce(eu);
      expect(await acoes.aprovarProposta(r.proposta_id)).toMatchObject({ ok: false });
    }
    expect(await proposta(r.proposta_id)).toMatchObject({ status: "pendente" });
    expect(await contar("tarefa", "titulo = $1", [titulo])).toBe(0);

    t.eu.mockResolvedValue({ id: admin, papel: "admin" });
    expect(await acoes.aprovarProposta(r.proposta_id)).toMatchObject({ ok: true, dado: { status: "aprovada" } });
    expect(await acoes.aprovarProposta(r.proposta_id)).toEqual({ ok: false, erro: "Esta proposta já foi decidida." });
    expect(await contar("tarefa", "titulo = $1", [titulo])).toBe(1);
    t.eu.mockReset();
  });
});

describe("rota do MCP", () => {
  const segredo = `mocca_${"a".repeat(40)}`;
  let tokenRota: string;
  let n = 0;

  const pedido = (metodo: string, cabecalho: string | null, caminho = "/api/mcp", corpo?: unknown) =>
    new Request(`http://localhost${caminho}`, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(cabecalho ? { Authorization: cabecalho } : {}),
      },
      ...(corpo ? { body: JSON.stringify({ jsonrpc: "2.0", id: ++n, ...corpo }) } : {}),
    });
  const chamar = async (method: string, params: unknown) => {
    const r = await rota.POST(pedido("POST", `Bearer ${segredo}`, "/api/mcp", { method, params }));
    return { status: r.status, corpo: await r.json() };
  };

  beforeAll(async () => {
    const hash = createHash("sha256").update(segredo).digest("hex");
    tokenRota = (await um<{ id: string }>("insert into token_api (nome, hash) values ('rota', $1) returning id", [hash]))!.id;
  });

  it("recusa quem não tem token antes de olhar o método", async () => {
    for (const metodo of ["GET", "POST", "DELETE"] as const) {
      const r = await rota[metodo](pedido(metodo, null));
      expect(r.status).toBe(401);
      expect(await r.json()).toMatchObject({ erro: { codigo: "sem_token" } });
    }
  });

  it("recusa o token com o prefixo repetido", async () => {
    const r = await rota.POST(pedido("POST", `Bearer mocca_${segredo}`));
    expect(r.status).toBe(401);
  });

  it("não abre fluxo em GET e DELETE, que prenderiam a função", async () => {
    for (const metodo of ["GET", "DELETE"] as const) {
      const r = await rota[metodo](pedido(metodo, `Bearer ${segredo}`));
      expect(r.status).toBe(405);
      expect(r.headers.get("allow")).toBe("POST");
      expect(r.headers.get("content-type")).not.toContain("text/event-stream");
      expect(await r.json()).toMatchObject({ erro: { codigo: "metodo_nao_permitido" } });
    }
  });

  it("lista as ferramentas e avisa nas de escrita que nada vale sem aprovação", async () => {
    const { status, corpo } = await chamar("tools/list", {});
    expect(status).toBe(200);
    const ferramentas: { name: string; description: string }[] = corpo.result.tools;
    expect(ferramentas.map((f) => f.name)).toContain("listar_propostas");
    for (const nome of ["criar_tarefa", "atualizar_tarefa", "atribuir", "marcar_item", "adicionar_documento", "comentar"])
      expect(ferramentas.find((f) => f.name === nome)!.description).toContain("depois que um admin aprovar");
  });

  it("toda escrita pelo MCP vira proposta do token que pediu", async () => {
    const titulo = "Pedido pelo MCP";
    const { corpo } = await chamar("tools/call", { name: "criar_tarefa", arguments: { titulo } });
    const r = JSON.parse(corpo.result.content[0].text);
    expect(r).toMatchObject({ status: "pendente" });
    expect(await proposta(r.proposta_id)).toMatchObject({ status: "pendente", token_id: tokenRota });
    expect(await contar("tarefa", "titulo = $1", [titulo])).toBe(0);
  });

  it("devolve o erro de negócio ao Claude sem criar proposta", async () => {
    const antes = await contar("proposta");
    const { corpo } = await chamar("tools/call", { name: "criar_tarefa", arguments: { titulo: "x", atribuicoes: [{ pessoa: "Ninguém" }] } });
    expect(corpo.result.isError).toBe(true);
    expect(JSON.parse(corpo.result.content[0].text)).toMatchObject({ erro: { codigo: "pessoa_inexistente" } });
    expect(await contar("proposta")).toBe(antes);
  });

  it("ainda aceita o token na URL, para quem não trocou pelo cabeçalho", async () => {
    const r = await rota.POST(pedido("POST", null, `/api/mcp?token=${segredo}`, { method: "tools/list", params: {} }));
    expect(r.status).toBe(200);
  });
});

describe("acompanhar as propostas", () => {
  it("mostra a situação de cada pedido e leva à tarefa depois de aprovada", async () => {
    const pendente = await api.criarTarefa({ titulo: "Segue pendente" }, token);
    const aprovada = await api.criarTarefa({ titulo: "Já aprovada" }, token);
    const a = await api.aprovarProposta(aprovada.proposta_id, admin);

    const pendentes = await api.listarPropostas("pendente");
    expect(pendentes.map((p) => p.id)).toContain(pendente.proposta_id);
    expect(pendentes.map((p) => p.id)).not.toContain(aprovada.proposta_id);
    expect(pendentes.every((p) => p.status === "pendente")).toBe(true);

    const todas = await api.listarPropostas();
    const vista = todas.find((p) => p.id === aprovada.proposta_id)!;
    expect(vista).toMatchObject({ status: "aprovada", link: expect.stringContaining(`/painel/tarefas/${a.status === "aprovada" ? a.id : ""}`) });
    expect(vista).not.toHaveProperty("token_id");
  });
});

describe("leituras", () => {
  it("não mostram o que ainda espera aprovação", async () => {
    const titulo = "Invisível até aprovar";
    await api.criarTarefa({ titulo }, token);
    expect((await api.listarTarefas({})).map((x) => x.titulo)).not.toContain(titulo);
  });
});
