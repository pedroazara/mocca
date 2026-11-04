import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { comoServico, type Consulta } from "@/lib/banco";
import { avisarAtribuicao } from "@/lib/email";
import * as dados from "@/lib/painel/dados";
import { fimDaSemanaIso, proximaReuniao, semanaAtual } from "@/lib/painel/datas";
import { SQL_MOVER_PARA_SEMANA } from "@/lib/painel/mover";
import { linkProposta, linkTarefa } from "@/lib/painel/links";
import { montarPauta, reuniaoAnteriorA } from "@/lib/painel/pauta";
import type { Status, StatusProposta } from "@/lib/painel/tipos";
import { normalizar } from "@/lib/painel/trello";
import { resolverPessoa, type PessoaApi } from "./pessoas";

// Operações da API do Claude (seção 11), usadas pela API REST e pelo servidor
// MCP. Leituras respondem direto. Escritas viram uma proposta e só são aplicadas
// quando um admin aprova no painel (seção 11.4). Tudo roda com o service role
// depois que o token foi validado; o histórico fica marcado via_api.

export class ErroApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensagem: string,
    public extra?: Record<string, unknown>,
  ) {
    super(mensagem);
  }
}

// ---------------------------------------------------------------- token e limite

const janela = new Map<string, number[]>();
const LIMITE_POR_MINUTO = 120;

export async function validarToken(cabecalho: string | null) {
  const token = cabecalho?.match(/^Bearer\s+(mocca_[A-Za-z0-9]{40})$/)?.[1];
  if (!token) throw new ErroApi(401, "sem_token", "Envie o token no cabeçalho Authorization: Bearer mocca_...");
  const hash = createHash("sha256").update(token).digest("hex");
  const [t] = await comoServico((q) =>
    q<{ id: string }>(
      "update token_api set ultimo_uso = now() where hash = $1 and not revogado returning id",
      [hash],
    ),
  );
  if (!t) throw new ErroApi(401, "token_invalido", "Token inválido ou revogado.");
  // limite de 120 requisições por minuto por token (por instância do servidor)
  const agora = Date.now();
  const recentes = (janela.get(t.id) ?? []).filter((x) => agora - x < 60000);
  if (recentes.length >= LIMITE_POR_MINUTO) throw new ErroApi(429, "limite", "Mais de 120 requisições por minuto. Espere um pouco.");
  recentes.push(agora);
  janela.set(t.id, recentes);
  return t.id;
}

// ---------------------------------------------------------------- auxiliares

async function pessoasAtivas(q: Consulta) {
  return q<PessoaApi>("select id, nome, apelido, email, frente from pessoa where ativo order by nome");
}

const ID = /^[0-9a-f-]{36}$/i;

function exigirPessoa(ref: string, pessoas: PessoaApi[]) {
  const r = resolverPessoa(ref, pessoas);
  if (r.ok) return r.pessoa;
  const validas = pessoas.map((p) => ({ id: p.id, nome: p.nome, apelido: p.apelido, email: p.email }));
  throw new ErroApi(
    422,
    r.motivo === "ambigua" ? "pessoa_ambigua" : "pessoa_inexistente",
    r.motivo === "ambigua"
      ? `"${ref}" bate com mais de uma pessoa. Use o id, o e-mail ou o apelido exato.`
      : // a proposta guarda o id: é esse o texto que o admin vê se a pessoa saiu da equipe
        ID.test(ref)
        ? "Essa pessoa não está mais ativa na equipe."
        : `Não encontrei a pessoa "${ref}".`,
    { pessoas_validas: validas },
  );
}

async function idsEtiquetas(q: Consulta, nomes: string[]) {
  const todas = await q<{ id: string; nome: string }>("select id, nome from etiqueta");
  return nomes.map((n) => {
    const e = todas.find((x) => normalizar(x.nome) === normalizar(n));
    if (!e) throw new ErroApi(422, "etiqueta_inexistente", `Etiqueta "${n}" não existe.`, { etiquetas_validas: todas.map((x) => x.nome) });
    return e.id;
  });
}

// Para o pedido: a mesma etiqueta duas vezes bateria na chave de tarefa_etiqueta
// ao aplicar, e a proposta ficaria pendente sem nunca dar certo.
async function conferirEtiquetas(q: Consulta, nomes: string[]) {
  const ids = await idsEtiquetas(q, nomes);
  if (new Set(ids).size < ids.length) throw new ErroApi(422, "etiqueta_repetida", "A mesma etiqueta aparece mais de uma vez.");
}

async function semanaPorNumero(q: Consulta, numero: number | null | undefined) {
  if (numero === null || numero === undefined) return null;
  const [s] = await q<{ id: string; fim: string }>("select id, fim::text as fim from semana where numero = $1", [numero]);
  if (!s) throw new ErroApi(422, "semana_inexistente", `A semana ${numero} não existe (use 1 a 12).`);
  return s;
}

async function exigirTarefa(q: Consulta, id: string) {
  if (!ID.test(id)) throw new ErroApi(404, "tarefa_inexistente", "Tarefa não encontrada.");
  const [t] = await q<{ id: string }>("select id from tarefa where id = $1", [id]);
  if (!t) throw new ErroApi(404, "tarefa_inexistente", "Tarefa não encontrada.");
  return t.id;
}

async function exigirItem(q: Consulta, itemId: string) {
  if (!ID.test(itemId)) throw new ErroApi(404, "item_inexistente", "Item não encontrado.");
  const [i] = await q<{ id: string; tarefa_id: string }>(
    "select i.id, a.tarefa_id from item i join atribuicao a on a.id = i.atribuicao_id where i.id = $1",
    [itemId],
  );
  if (!i) throw new ErroApi(404, "item_inexistente", "Item não encontrado.");
  return i;
}

const URL_DRIVE = /^https:\/\/(drive|docs)\.google\.com\//;
const TIPOS = ["roteiro", "registro", "sintese", "entregavel", "outro"] as const;
const STATUS = ["a_fazer", "fazendo", "em_revisao", "feito"] as const;
const STATUS_PROPOSTA = ["pendente", "aprovada", "recusada", "falhou"] as const;

// ---------------------------------------------------------------- esquemas

export const esquemaAtribuicao = z.object({
  pessoa: z.string().min(1),
  papel: z.enum(["responsavel", "apoio"]).optional(),
  itens: z.array(z.string().min(1).max(500)).optional(),
});

export const esquemaDocumento = z.object({
  titulo: z.string().min(1).max(200),
  url: z.string().regex(URL_DRIVE, "Use um link do Google Drive ou do Google Docs."),
  tipo: z.enum(TIPOS).optional(),
});

export const esquemaNovaTarefa = z.object({
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().max(20000).nullish(),
  semana: z.number().int().min(1).max(12).nullish(),
  prazo: z.string().datetime({ offset: true }).nullish(),
  status: z.enum(STATUS).optional(),
  etiquetas: z.array(z.string()).optional(),
  ligada_entrega: z.boolean().optional(),
  origem: z.enum(["claude", "reuniao"]).optional(),
  atribuicoes: z.array(esquemaAtribuicao).optional(),
  documentos: z.array(esquemaDocumento).optional(),
});

export const esquemaAtualizacao = z.object({
  titulo: z.string().trim().min(1).max(200).optional(),
  descricao: z.string().max(20000).nullish(),
  status: z.enum(STATUS).optional(),
  prazo: z.string().datetime({ offset: true }).nullish(),
  semana: z.number().int().min(1).max(12).nullish(),
  etiquetas: z.array(z.string()).optional(),
  ligada_entrega: z.boolean().optional(),
});

export const esquemaStatusProposta = z.enum(STATUS_PROPOSTA).nullish();

export function validar<T>(esquema: z.ZodType<T>, corpo: unknown): T {
  const r = esquema.safeParse(corpo);
  if (!r.success)
    throw new ErroApi(400, "dados_invalidos", "Confira os campos enviados.", {
      problemas: r.error.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message })),
    });
  return r.data;
}

// ---------------------------------------------------------------- operações

export async function listarPessoas() {
  return comoServico((q) => pessoasAtivas(q));
}

export async function listarSemanas(apenasAtual = false) {
  return comoServico(async (q) => {
    const s = await dados.semanas(q);
    const atual = semanaAtual(s);
    const lista = apenasAtual ? (atual ? [atual] : []) : s;
    return lista.map((x) => ({ ...x, atual: x.numero === atual?.numero }));
  });
}

export async function listarTarefas(f: { semana?: number | null; pessoa?: string | null; status?: Status | null; etiqueta?: string | null; atrasadas?: boolean }) {
  return comoServico(async (q) => {
    const pessoa = f.pessoa ? exigirPessoa(f.pessoa, await pessoasAtivas(q)).id : null;
    const etiqueta = f.etiqueta ? (await idsEtiquetas(q, [f.etiqueta]))[0] : null;
    const lista = await dados.tarefas(q, { semana: f.semana ?? null, pessoa, status: f.status ?? null, etiqueta, atrasadas: f.atrasadas });
    const pessoas = await pessoasAtivas(q);
    const nome = (id: string) => pessoas.find((p) => p.id === id)?.apelido ?? pessoas.find((p) => p.id === id)?.nome ?? id;
    return lista.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      status: t.status,
      semana: t.semana,
      prazo: t.prazo,
      ligada_entrega: t.ligada_entrega,
      responsaveis: t.atribuicoes.filter((a) => a.papel === "responsavel").map((a) => nome(a.pessoa_id)),
      apoio: t.atribuicoes.filter((a) => a.papel === "apoio").map((a) => nome(a.pessoa_id)),
      itens: { feitos: t.atribuicoes.flatMap((a) => a.itens).filter((i) => i.feito).length, total: t.atribuicoes.flatMap((a) => a.itens).length },
      link: linkTarefa(t.id),
    }));
  });
}

export async function verTarefa(id: string) {
  return comoServico(async (q) => {
    await exigirTarefa(q, id);
    const t = (await dados.tarefa(q, id))!;
    const pessoas = await q<PessoaApi>("select id, nome, apelido, email, frente from pessoa");
    const etqs = await q<{ id: string; nome: string }>("select id, nome from etiqueta");
    const p = (pid: string | null) => pessoas.find((x) => x.id === pid);
    return {
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      status: t.status,
      semana: t.semana,
      prazo: t.prazo,
      ligada_entrega: t.ligada_entrega,
      origem: t.origem,
      arquivada: t.arquivada,
      etiquetas: t.etiquetas.map((e) => etqs.find((x) => x.id === e)?.nome ?? e),
      atribuicoes: t.atribuicoes.map((a) => ({
        pessoa: { id: a.pessoa_id, nome: p(a.pessoa_id)?.nome, apelido: p(a.pessoa_id)?.apelido },
        papel: a.papel,
        itens: a.itens,
      })),
      documentos: t.lista_documentos,
      comentarios: t.lista_comentarios.map((c) => ({ ...c, autor: c.autor_id ? p(c.autor_id)?.nome : "Claude" })),
      link: linkTarefa(t.id),
    };
  });
}

async function atribuirNaTransacao(
  q: Consulta,
  tarefaId: string,
  pessoa: PessoaApi,
  papel: "responsavel" | "apoio" | undefined,
  itens: string[] = [],
) {
  const [existe] = await q<{ n: number }>(
    "select count(*)::int as n from atribuicao where tarefa_id = $1 and papel = 'responsavel'",
    [tarefaId],
  );
  const papelFinal = papel ?? (existe.n ? "apoio" : "responsavel");
  // xmax = 0: a linha foi inserida agora, não atualizada pelo on conflict
  const [a] = await q<{ id: string; nova: boolean }>(
    `insert into atribuicao (tarefa_id, pessoa_id, papel, posicao)
     values ($1, $2, $3::papel_atrib, (select coalesce(max(posicao), 0) + 1 from atribuicao where tarefa_id = $1))
     on conflict (tarefa_id, pessoa_id) do update set papel = coalesce($4::papel_atrib, atribuicao.papel)
     returning id, (xmax = 0) as nova`,
    [tarefaId, pessoa.id, papelFinal, papel ?? null],
  );
  if (a.nova) avisarAtribuicao(tarefaId, pessoa.id);
  for (const texto of itens)
    await q(
      `insert into item (atribuicao_id, texto, posicao)
       values ($1, $2, (select coalesce(max(posicao), 0) + 1 from item where atribuicao_id = $1))`,
      [a.id, texto],
    );
  return a.id;
}

// ---------------------------------------------------------------- escritas

// O que cada escrita guarda na proposta.
type Dados = {
  criar_tarefa: z.infer<typeof esquemaNovaTarefa>;
  atualizar_tarefa: { tarefa_id: string; campos: z.infer<typeof esquemaAtualizacao> };
  atribuir: { tarefa_id: string } & z.infer<typeof esquemaAtribuicao>;
  remover_atribuicao: { tarefa_id: string; pessoa: string };
  adicionar_item: { tarefa_id: string; pessoa: string; texto: string };
  atualizar_item: { item_id: string; tarefa_id?: string; feito?: boolean; texto?: string };
  adicionar_documento: { tarefa_id: string } & z.infer<typeof esquemaDocumento>;
  comentar: { tarefa_id: string; texto: string };
};

export type Pedido = { [O in keyof Dados]: { operacao: O; dados: Dados[O] } }[keyof Dados];

// `conferir` roda no pedido, sem gravar, para o Claude receber o erro na hora, e
// devolve os dados como serão aplicados: pessoas pelo id, para valer o que o admin
// viu. `aplicar` só roda na aprovação e confere tudo de novo, porque o painel pode
// ter mudado nesse meio-tempo. `resultado.id` é sempre a tarefa afetada.
type Operacao<D> = {
  conferir: (q: Consulta, d: D) => Promise<D>;
  aplicar: (q: Consulta, d: D) => Promise<{ id: string; link: string }>;
};

const idDaPessoa = async (q: Consulta, ref: string) => exigirPessoa(ref, await pessoasAtivas(q)).id;

const OPERACOES: { [O in keyof Dados]: Operacao<Dados[O]> } = {
  criar_tarefa: {
    async conferir(q, d) {
      const pessoas = await pessoasAtivas(q);
      const atribuicoes = d.atribuicoes?.map((a) => ({ ...a, pessoa: exigirPessoa(a.pessoa, pessoas).id }));
      // a segunda atribuição trocaria o papel da primeira, e a tela mostraria as duas
      const ids = atribuicoes?.map((a) => a.pessoa) ?? [];
      if (new Set(ids).size < ids.length)
        throw new ErroApi(422, "pessoa_repetida", "A mesma pessoa aparece em mais de uma atribuição. Junte os itens dela numa só.");
      await conferirEtiquetas(q, d.etiquetas ?? []);
      await semanaPorNumero(q, d.semana);
      return { ...d, atribuicoes };
    },
    async aplicar(q, corpo) {
      const pessoas = await pessoasAtivas(q);
      // valida tudo antes de gravar: a transação inteira cai se algo falhar
      const atribs = (corpo.atribuicoes ?? []).map((a) => ({ ...a, p: exigirPessoa(a.pessoa, pessoas) }));
      const etqs = await idsEtiquetas(q, corpo.etiquetas ?? []);
      const semana = await semanaPorNumero(q, corpo.semana);
      const status = corpo.status ?? "a_fazer";
      const [t] = await q<{ id: string }>(
        `insert into tarefa (titulo, descricao, status, semana_id, prazo, ligada_entrega, origem, posicao)
         values ($1, $2, $3::status_tarefa, $4, $5, $6, $7::origem_tarefa,
                 (select coalesce(max(posicao), 0) + 1 from tarefa where status = $3::status_tarefa))
         returning id`,
        [
          corpo.titulo,
          corpo.descricao ?? null,
          status,
          semana?.id ?? null,
          corpo.prazo ?? (semana ? fimDaSemanaIso(semana.fim) : null),
          Boolean(corpo.ligada_entrega),
          corpo.origem ?? "claude",
        ],
      );
      for (const e of etqs) await q("insert into tarefa_etiqueta (tarefa_id, etiqueta_id) values ($1, $2)", [t.id, e]);
      for (const a of atribs) await atribuirNaTransacao(q, t.id, a.p, a.papel, a.itens);
      for (const d of corpo.documentos ?? [])
        await q("insert into documento (tarefa_id, titulo, url, tipo) values ($1, $2, $3, $4::tipo_documento)", [t.id, d.titulo, d.url, d.tipo ?? "outro"]);
      return { id: t.id, link: linkTarefa(t.id) };
    },
  },

  atualizar_tarefa: {
    async conferir(q, d) {
      await exigirTarefa(q, d.tarefa_id);
      if (!Object.keys(d.campos).length) throw new ErroApi(400, "sem_mudancas", "Envie ao menos um campo para mudar.");
      await conferirEtiquetas(q, d.campos.etiquetas ?? []);
      await semanaPorNumero(q, d.campos.semana);
      return d;
    },
    async aplicar(q, { tarefa_id: id, campos: c }) {
      await exigirTarefa(q, id);
      const sets: string[] = [];
      const vals: unknown[] = [];
      const add = (col: string, v: unknown, cast = "") => {
        vals.push(v);
        sets.push(`${col} = $${vals.length + 1}${cast}`);
      };
      if (c.titulo !== undefined) add("titulo", c.titulo);
      if (c.descricao !== undefined) add("descricao", c.descricao);
      if (c.status !== undefined) add("status", c.status, "::status_tarefa");
      if (c.prazo !== undefined) add("prazo", c.prazo);
      if (c.ligada_entrega !== undefined) add("ligada_entrega", c.ligada_entrega);
      // trocar só a semana leva o prazo junto, como no painel (DUVIDAS 4m)
      const moverSemana = typeof c.semana === "number" && c.prazo === undefined;
      if (c.semana !== undefined && !moverSemana) add("semana_id", (await semanaPorNumero(q, c.semana))?.id ?? null);
      if (sets.length) await q(`update tarefa set ${sets.join(", ")} where id = $1`, [id, ...vals]);
      if (moverSemana) await q(SQL_MOVER_PARA_SEMANA, [id, c.semana]);
      if (c.etiquetas) {
        const etqs = await idsEtiquetas(q, c.etiquetas);
        await q("delete from tarefa_etiqueta where tarefa_id = $1", [id]);
        for (const e of etqs) await q("insert into tarefa_etiqueta (tarefa_id, etiqueta_id) values ($1, $2)", [id, e]);
      }
      return { id, link: linkTarefa(id) };
    },
  },

  atribuir: {
    async conferir(q, d) {
      await exigirTarefa(q, d.tarefa_id);
      return { ...d, pessoa: await idDaPessoa(q, d.pessoa) };
    },
    async aplicar(q, { tarefa_id, pessoa, papel, itens }) {
      await exigirTarefa(q, tarefa_id);
      const p = exigirPessoa(pessoa, await pessoasAtivas(q));
      await atribuirNaTransacao(q, tarefa_id, p, papel, itens);
      return { id: tarefa_id, pessoa: p.nome, link: linkTarefa(tarefa_id) };
    },
  },

  remover_atribuicao: {
    async conferir(q, d) {
      await exigirTarefa(q, d.tarefa_id);
      const p = exigirPessoa(d.pessoa, await pessoasAtivas(q));
      const [a] = await q("select id from atribuicao where tarefa_id = $1 and pessoa_id = $2", [d.tarefa_id, p.id]);
      if (!a) throw new ErroApi(404, "atribuicao_inexistente", `${p.nome} não está nesta tarefa.`);
      return { ...d, pessoa: p.id };
    },
    async aplicar(q, { tarefa_id, pessoa }) {
      await exigirTarefa(q, tarefa_id);
      const p = exigirPessoa(pessoa, await pessoasAtivas(q));
      const r = await q("delete from atribuicao where tarefa_id = $1 and pessoa_id = $2 returning id", [tarefa_id, p.id]);
      if (!r.length) throw new ErroApi(404, "atribuicao_inexistente", `${p.nome} não está nesta tarefa.`);
      return { id: tarefa_id, link: linkTarefa(tarefa_id) };
    },
  },

  adicionar_item: {
    async conferir(q, d) {
      await exigirTarefa(q, d.tarefa_id);
      return { ...d, pessoa: await idDaPessoa(q, d.pessoa) };
    },
    async aplicar(q, { tarefa_id, pessoa, texto }) {
      await exigirTarefa(q, tarefa_id);
      const p = exigirPessoa(pessoa, await pessoasAtivas(q));
      const [a] = await q<{ id: string }>("select id from atribuicao where tarefa_id = $1 and pessoa_id = $2", [tarefa_id, p.id]);
      const atrib = a?.id ?? (await atribuirNaTransacao(q, tarefa_id, p, undefined));
      const [i] = await q<{ id: string }>(
        `insert into item (atribuicao_id, texto, posicao)
         values ($1, $2, (select coalesce(max(posicao), 0) + 1 from item where atribuicao_id = $1)) returning id`,
        [atrib, texto],
      );
      return { item_id: i.id, id: tarefa_id, link: linkTarefa(tarefa_id) };
    },
  },

  atualizar_item: {
    async conferir(q, d) {
      if (d.feito === undefined && d.texto === undefined) throw new ErroApi(400, "sem_mudancas", "Envie feito ou texto.");
      // guarda o id como o banco escreve: é por ele que a tela acha o item
      const i = await exigirItem(q, d.item_id);
      return { ...d, item_id: i.id, tarefa_id: i.tarefa_id };
    },
    async aplicar(q, { item_id, feito, texto }) {
      const { tarefa_id } = await exigirItem(q, item_id);
      await q("update item set feito = coalesce($2, feito), texto = coalesce($3, texto) where id = $1", [item_id, feito ?? null, texto ?? null]);
      return { item_id, id: tarefa_id, link: linkTarefa(tarefa_id) };
    },
  },

  adicionar_documento: {
    async conferir(q, d) {
      await exigirTarefa(q, d.tarefa_id);
      return d;
    },
    async aplicar(q, { tarefa_id, titulo, url, tipo }) {
      await exigirTarefa(q, tarefa_id);
      await q("insert into documento (tarefa_id, titulo, url, tipo) values ($1, $2, $3, $4::tipo_documento)", [tarefa_id, titulo, url, tipo ?? "outro"]);
      return { id: tarefa_id, link: linkTarefa(tarefa_id) };
    },
  },

  comentar: {
    async conferir(q, d) {
      await exigirTarefa(q, d.tarefa_id);
      return d;
    },
    async aplicar(q, { tarefa_id, texto }) {
      await exigirTarefa(q, tarefa_id);
      await q("insert into comentario (tarefa_id, autor_id, via_api, texto) values ($1, null, true, $2)", [tarefa_id, texto]);
      return { id: tarefa_id, link: linkTarefa(tarefa_id) };
    },
  },
};

async function propor<O extends keyof Dados>(operacao: O, d: Dados[O], tokenId: string) {
  const op: Operacao<Dados[O]> = OPERACOES[operacao];
  return comoServico(async (q) => {
    const conferidos = await op.conferir(q, d);
    const tarefaId = (conferidos as { tarefa_id?: string }).tarefa_id ?? null;
    // $2::text::jsonb de propósito: ver a nota em app/api/contato/route.ts
    const [p] = await q<{ id: string }>(
      "insert into proposta (operacao, dados, tarefa_id, token_id) values ($1, $2::text::jsonb, $3, $4) returning id",
      [operacao, JSON.stringify(conferidos), tarefaId, tokenId],
    );
    return {
      status: "pendente" as const,
      proposta_id: p.id,
      tarefa_id: tarefaId,
      link: linkProposta(p.id),
      mensagem: "Pedido registrado. Nada mudou no painel: a mudança só vale depois que um admin aprovar.",
    };
  });
}

export const criarTarefa = (corpo: Dados["criar_tarefa"], tokenId: string) => propor("criar_tarefa", corpo, tokenId);

export const atualizarTarefa = (id: string, campos: Dados["atualizar_tarefa"]["campos"], tokenId: string) =>
  propor("atualizar_tarefa", { tarefa_id: id, campos }, tokenId);

export const atribuir = (tarefaId: string, a: z.infer<typeof esquemaAtribuicao>, tokenId: string) =>
  propor("atribuir", { tarefa_id: tarefaId, ...a }, tokenId);

export const removerAtribuicao = (tarefaId: string, pessoa: string, tokenId: string) =>
  propor("remover_atribuicao", { tarefa_id: tarefaId, pessoa }, tokenId);

export const adicionarItem = (tarefaId: string, pessoa: string, texto: string, tokenId: string) =>
  propor("adicionar_item", { tarefa_id: tarefaId, pessoa, texto }, tokenId);

export const atualizarItem = (itemId: string, c: { feito?: boolean; texto?: string }, tokenId: string) =>
  propor("atualizar_item", { item_id: itemId, ...c }, tokenId);

export const adicionarDocumento = (tarefaId: string, d: z.infer<typeof esquemaDocumento>, tokenId: string) =>
  propor("adicionar_documento", { tarefa_id: tarefaId, ...d }, tokenId);

export const comentar = (tarefaId: string, texto: string, tokenId: string) =>
  propor("comentar", { tarefa_id: tarefaId, texto }, tokenId);

// ---------------------------------------------------------------- aprovação

// Para o Claude acompanhar o que pediu.
export async function listarPropostas(status?: StatusProposta | null) {
  return comoServico(async (q) => {
    const lista = await q<{ id: string; status: StatusProposta; tarefa_id: string | null }>(
      `select id, operacao, dados, tarefa_id, status::text as status, criado_em, decidido_em, erro
         from proposta
        where $1::status_proposta is null or status = $1::status_proposta
        order by criado_em desc limit 50`,
      [status ?? null],
    );
    return lista.map((p) => ({ ...p, link: p.status === "aprovada" && p.tarefa_id ? linkTarefa(p.tarefa_id) : linkProposta(p.id) }));
  });
}

// Só o painel chama, depois de conferir que quem pediu é admin (service role
// ignora o RLS). Tudo numa transação: o `for update` faz um clique duplo esperar
// o primeiro e não achar mais a proposta pendente, e se aplicar falhar nada fica
// pela metade. Quando o painel mudou e não dá mais para aplicar, a proposta vira
// `falhou`, em outra transação. Erro inesperado, como queda do banco, sobe para
// quem chamou e mantém a proposta pendente, para o admin tentar de novo.
export async function aprovarProposta(id: string, adminId: string) {
  if (!ID.test(id)) throw new ErroApi(404, "proposta_inexistente", "Proposta não encontrada.");
  try {
    return await comoServico(async (q) => {
      const [p] = await q<Pedido>("select operacao, dados from proposta where id = $1 and status = 'pendente' for update", [id]);
      if (!p) throw new ErroApi(409, "proposta_decidida", "Esta proposta já foi decidida.");
      const resultado = await OPERACOES[p.operacao].aplicar(q, p.dados as never);
      await q(
        `update proposta
            set status = 'aprovada', decidido_por = $2, decidido_em = now(), resultado = $3::text::jsonb,
                tarefa_id = coalesce(tarefa_id, $4)
          where id = $1`,
        [id, adminId, JSON.stringify(resultado), resultado.id],
      );
      return { status: "aprovada" as const, ...resultado };
    });
  } catch (e) {
    if (!(e instanceof ErroApi) || e.codigo === "proposta_decidida") throw e;
    await comoServico((q) =>
      q("update proposta set status = 'falhou', decidido_por = $2, decidido_em = now(), erro = $3 where id = $1 and status = 'pendente'", [id, adminId, e.message]),
    );
    return { status: "falhou" as const, erro: e.message };
  }
}

export async function pautaProximaReuniao() {
  return comoServico(async (q) => {
    const [semanas, tarefas, contatos, reunioes, cfg] = [
      await dados.semanas(q),
      await dados.tarefas(q),
      await dados.contatos(q, { status: "novo" }),
      await dados.reunioes(q),
      await dados.configuracao(q),
    ];
    const agora = Date.now();
    const futura = [...reunioes].reverse().find((r) => new Date(r.data).getTime() >= agora - 3 * 3600000);
    const data = futura?.data ?? proximaReuniao(cfg.reuniao_dia_semana, cfg.reuniao_hora)?.toISOString();
    if (!data) throw new ErroApi(404, "sem_reuniao", "Nenhuma reunião marcada e o dia da reunião semanal não foi configurado.");
    const p = montarPauta({ semanas, tarefas, contatos, dataReuniao: data, reuniaoAnterior: reuniaoAnteriorA(reunioes, data) });
    const resumo = (t: (typeof tarefas)[number]) => ({ id: t.id, titulo: t.titulo, status: t.status, prazo: t.prazo, link: linkTarefa(t.id) });
    return {
      data,
      reuniao_id: futura?.id ?? null,
      entrega: p.semana
        ? { semana: p.semana.numero, titulo: p.semana.entrega_titulo, prazo: p.semana.entrega_prazo, status: p.semana.status, tarefas: p.entrega.map(resumo) }
        : null,
      atrasadas: p.atrasadas.map(resumo),
      concluidas_desde_a_ultima: p.concluidas.map(resumo),
      contatos_novos: p.contatosNovos.map((c) => ({ id: c.id, nome: c.nome, perfil: c.perfil, cidade_uf: c.cidade_uf, recebido_em: c.criado_em })),
    };
  });
}
