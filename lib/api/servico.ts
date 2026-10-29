import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { comoServico, type Consulta } from "@/lib/banco";
import * as dados from "@/lib/painel/dados";
import { fimDaSemanaIso, proximaReuniao, semanaAtual } from "@/lib/painel/datas";
import { montarPauta, reuniaoAnteriorA } from "@/lib/painel/pauta";
import type { Status } from "@/lib/painel/tipos";
import { normalizar } from "@/lib/painel/trello";
import { resolverPessoa, type PessoaApi } from "./pessoas";

// Operações da API do Claude (seção 11), usadas pela API REST e pelo servidor
// MCP. Rodam com o service role depois que o token foi validado; o histórico
// fica marcado via_api.

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

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const linkTarefa = (id: string) => `${SITE()}/painel/tarefas/${id}`;

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

function exigirPessoa(ref: string, pessoas: PessoaApi[]) {
  const r = resolverPessoa(ref, pessoas);
  if (r.ok) return r.pessoa;
  const validas = pessoas.map((p) => ({ id: p.id, nome: p.nome, apelido: p.apelido, email: p.email }));
  throw new ErroApi(
    422,
    r.motivo === "ambigua" ? "pessoa_ambigua" : "pessoa_inexistente",
    r.motivo === "ambigua"
      ? `"${ref}" bate com mais de uma pessoa. Use o id, o e-mail ou o apelido exato.`
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

async function semanaPorNumero(q: Consulta, numero: number | null | undefined) {
  if (numero === null || numero === undefined) return null;
  const [s] = await q<{ id: string; fim: string }>("select id, fim::text as fim from semana where numero = $1", [numero]);
  if (!s) throw new ErroApi(422, "semana_inexistente", `A semana ${numero} não existe (use 1 a 12).`);
  return s;
}

async function exigirTarefa(q: Consulta, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroApi(404, "tarefa_inexistente", "Tarefa não encontrada.");
  const [t] = await q<{ id: string }>("select id from tarefa where id = $1", [id]);
  if (!t) throw new ErroApi(404, "tarefa_inexistente", "Tarefa não encontrada.");
  return t.id;
}

const URL_DRIVE = /^https:\/\/(drive|docs)\.google\.com\//;
const TIPOS = ["roteiro", "registro", "sintese", "entregavel", "outro"] as const;
const STATUS = ["a_fazer", "fazendo", "em_revisao", "feito"] as const;

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
  const [a] = await q<{ id: string }>(
    `insert into atribuicao (tarefa_id, pessoa_id, papel, posicao)
     values ($1, $2, $3::papel_atrib, (select coalesce(max(posicao), 0) + 1 from atribuicao where tarefa_id = $1))
     on conflict (tarefa_id, pessoa_id) do update set papel = coalesce($4::papel_atrib, atribuicao.papel)
     returning id`,
    [tarefaId, pessoa.id, papelFinal, papel ?? null],
  );
  for (const texto of itens)
    await q(
      `insert into item (atribuicao_id, texto, posicao)
       values ($1, $2, (select coalesce(max(posicao), 0) + 1 from item where atribuicao_id = $1))`,
      [a.id, texto],
    );
  return a.id;
}

export async function criarTarefa(corpo: z.infer<typeof esquemaNovaTarefa>) {
  return comoServico(async (q) => {
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
  });
}

export async function atualizarTarefa(id: string, c: z.infer<typeof esquemaAtualizacao>) {
  return comoServico(async (q) => {
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
    if (c.semana !== undefined) add("semana_id", (await semanaPorNumero(q, c.semana))?.id ?? null);
    if (sets.length) await q(`update tarefa set ${sets.join(", ")} where id = $1`, [id, ...vals]);
    if (c.etiquetas) {
      const etqs = await idsEtiquetas(q, c.etiquetas);
      await q("delete from tarefa_etiqueta where tarefa_id = $1", [id]);
      for (const e of etqs) await q("insert into tarefa_etiqueta (tarefa_id, etiqueta_id) values ($1, $2)", [id, e]);
    }
    return { id, link: linkTarefa(id) };
  });
}

export async function atribuir(tarefaId: string, a: z.infer<typeof esquemaAtribuicao>) {
  return comoServico(async (q) => {
    await exigirTarefa(q, tarefaId);
    const p = exigirPessoa(a.pessoa, await pessoasAtivas(q));
    await atribuirNaTransacao(q, tarefaId, p, a.papel, a.itens);
    return { id: tarefaId, pessoa: p.nome, link: linkTarefa(tarefaId) };
  });
}

export async function removerAtribuicao(tarefaId: string, ref: string) {
  return comoServico(async (q) => {
    await exigirTarefa(q, tarefaId);
    const p = exigirPessoa(ref, await pessoasAtivas(q));
    const r = await q("delete from atribuicao where tarefa_id = $1 and pessoa_id = $2 returning id", [tarefaId, p.id]);
    if (!r.length) throw new ErroApi(404, "atribuicao_inexistente", `${p.nome} não está nesta tarefa.`);
    return { id: tarefaId, link: linkTarefa(tarefaId) };
  });
}

export async function adicionarItem(tarefaId: string, ref: string, texto: string) {
  return comoServico(async (q) => {
    await exigirTarefa(q, tarefaId);
    const p = exigirPessoa(ref, await pessoasAtivas(q));
    const [a] = await q<{ id: string }>("select id from atribuicao where tarefa_id = $1 and pessoa_id = $2", [tarefaId, p.id]);
    const atrib = a?.id ?? (await atribuirNaTransacao(q, tarefaId, p, undefined));
    const [i] = await q<{ id: string }>(
      `insert into item (atribuicao_id, texto, posicao)
       values ($1, $2, (select coalesce(max(posicao), 0) + 1 from item where atribuicao_id = $1)) returning id`,
      [atrib, texto],
    );
    return { item_id: i.id, id: tarefaId, link: linkTarefa(tarefaId) };
  });
}

export async function atualizarItem(itemId: string, c: { feito?: boolean; texto?: string }) {
  return comoServico(async (q) => {
    if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new ErroApi(404, "item_inexistente", "Item não encontrado.");
    const [i] = await q<{ tarefa_id: string }>(
      `update item set feito = coalesce($2, feito), texto = coalesce($3, texto) where id = $1
       returning (select tarefa_id from atribuicao where id = item.atribuicao_id) as tarefa_id`,
      [itemId, c.feito ?? null, c.texto ?? null],
    );
    if (!i) throw new ErroApi(404, "item_inexistente", "Item não encontrado.");
    return { item_id: itemId, id: i.tarefa_id, link: linkTarefa(i.tarefa_id) };
  });
}

export async function adicionarDocumento(tarefaId: string, d: z.infer<typeof esquemaDocumento>) {
  return comoServico(async (q) => {
    await exigirTarefa(q, tarefaId);
    await q("insert into documento (tarefa_id, titulo, url, tipo) values ($1, $2, $3, $4::tipo_documento)", [tarefaId, d.titulo, d.url, d.tipo ?? "outro"]);
    return { id: tarefaId, link: linkTarefa(tarefaId) };
  });
}

export async function comentar(tarefaId: string, texto: string) {
  return comoServico(async (q) => {
    await exigirTarefa(q, tarefaId);
    await q("insert into comentario (tarefa_id, autor_id, via_api, texto) values ($1, null, true, $2)", [tarefaId, texto]);
    return { id: tarefaId, link: linkTarefa(tarefaId) };
  });
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
