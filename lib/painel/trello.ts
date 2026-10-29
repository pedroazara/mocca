// Importação única do quadro "Avança Café" do Trello (seção 12). Função pura:
// recebe o JSON exportado e devolve o plano do que será criado, para a prévia
// na tela e para a gravação no servidor (que roda o mesmo plano).

import type { Etiqueta, Pessoa, Semana, Status } from "./tipos";

type TrelloLista = { id: string; name: string; closed?: boolean };
type TrelloCartao = {
  id: string;
  name: string;
  desc?: string;
  idList: string;
  idLabels?: string[];
  idMembers?: string[];
  due?: string | null;
  closed?: boolean;
  pos?: number;
};
type TrelloEtiqueta = { id: string; name: string };
type TrelloChecklist = {
  id: string;
  name: string;
  idCard: string;
  pos?: number;
  checkItems?: { name: string; state: "complete" | "incomplete"; pos?: number }[];
};
type TrelloMembro = { id: string; fullName?: string; username?: string };

export type TrelloJson = {
  lists?: TrelloLista[];
  cards?: TrelloCartao[];
  labels?: TrelloEtiqueta[];
  checklists?: TrelloChecklist[];
  members?: TrelloMembro[];
};

export type PlanoTarefa = {
  trello_id: string;
  titulo: string;
  descricao: string | null;
  status: Status;
  semana: number | null;
  prazo: string | null;
  etiquetas: string[];
  atribuicoes: { pessoa_id: string; papel: "responsavel" | "apoio"; itens: { texto: string; feito: boolean }[] }[];
  documentos: { titulo: string; url: string }[];
};

export type PlanoImportacao = {
  tarefas: PlanoTarefa[];
  documentosSemana1: { titulo: string; url: string }[];
  checklistsSemPessoa: string[];
  totais: { tarefas: number; itens: number; documentos: number };
};

export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const LINK_DRIVE = /https:\/\/(?:drive|docs)\.google\.com\/[^\s)\]>"']+/g;

// Reduz o JSON do Trello ao que a importação usa (o arquivo original traz o
// histórico inteiro do quadro e pode passar de alguns MB).
export function enxugar(j: TrelloJson): TrelloJson {
  return {
    lists: (j.lists ?? []).map(({ id, name, closed }) => ({ id, name, closed })),
    cards: (j.cards ?? []).map(({ id, name, desc, idList, idLabels, idMembers, due, closed, pos }) => ({
      id,
      name,
      desc,
      idList,
      idLabels,
      idMembers,
      due,
      closed,
      pos,
    })),
    labels: (j.labels ?? []).map(({ id, name }) => ({ id, name })),
    checklists: (j.checklists ?? []).map(({ id, name, idCard, pos, checkItems }) => ({
      id,
      name,
      idCard,
      pos,
      checkItems: (checkItems ?? []).map(({ name: n, state, pos: p }) => ({ name: n, state, pos: p })),
    })),
    members: (j.members ?? []).map(({ id, fullName, username }) => ({ id, fullName, username })),
  };
}

// Encontra a pessoa pelo nome do checklist ou do membro: apelido, nome
// completo ou primeiro nome, sem diferenciar maiúsculas e acentos.
export function acharPessoa(nome: string, pessoas: Pick<Pessoa, "id" | "nome" | "apelido">[]) {
  const n = normalizar(nome);
  if (!n) return undefined;
  return (
    pessoas.find((p) => p.apelido && normalizar(p.apelido) === n) ??
    pessoas.find((p) => normalizar(p.nome) === n) ??
    pessoas.find((p) => normalizar(p.nome.replace(/^Prof\.\s*/, "")).split(/\s+/)[0] === n.split(/\s+/)[0])
  );
}

function destinoDaLista(nome: string): { status: Status; semana: number | null } | "links" | null {
  const n = normalizar(nome);
  const semana = n.match(/^semana\s*(\d{1,2})$/);
  if (semana) return { status: "a_fazer", semana: Number(semana[1]) };
  if (n === "em andamento") return { status: "fazendo", semana: null };
  if (n === "finalizados" || n === "finalizado") return { status: "feito", semana: null };
  if (n === "links") return "links";
  return null;
}

export function planejarImportacao(
  json: TrelloJson,
  pessoas: Pick<Pessoa, "id" | "nome" | "apelido">[],
  etiquetas: Pick<Etiqueta, "id" | "nome">[],
  semanas: Pick<Semana, "numero">[],
): PlanoImportacao {
  const listas = new Map((json.lists ?? []).filter((l) => !l.closed).map((l) => [l.id, l]));
  const etqTrello = new Map((json.labels ?? []).map((l) => [l.id, l.name]));
  const membros = new Map((json.members ?? []).map((m) => [m.id, m.fullName || m.username || ""]));
  const etqPorNome = new Map(etiquetas.map((e) => [normalizar(e.nome), e.id]));
  const numeros = new Set(semanas.map((s) => s.numero));
  const checklistsPorCartao = new Map<string, TrelloChecklist[]>();
  for (const c of json.checklists ?? []) checklistsPorCartao.set(c.idCard, [...(checklistsPorCartao.get(c.idCard) ?? []), c]);

  const plano: PlanoImportacao = {
    tarefas: [],
    documentosSemana1: [],
    checklistsSemPessoa: [],
    totais: { tarefas: 0, itens: 0, documentos: 0 },
  };

  const cartoes = [...(json.cards ?? [])].filter((c) => !c.closed).sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  for (const c of cartoes) {
    const lista = listas.get(c.idList);
    if (!lista) continue;
    const destino = destinoDaLista(lista.name);
    if (!destino) continue;
    const links = [...new Set(`${c.name}\n${c.desc ?? ""}`.match(LINK_DRIVE) ?? [])];

    if (destino === "links") {
      for (const url of links) plano.documentosSemana1.push({ titulo: c.name.replace(LINK_DRIVE, "").trim() || "Link", url });
      continue;
    }

    const atribuicoes: PlanoTarefa["atribuicoes"] = [];
    const checklists = [...(checklistsPorCartao.get(c.id) ?? [])].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
    for (const ck of checklists) {
      const p = acharPessoa(ck.name, pessoas);
      if (!p) {
        plano.checklistsSemPessoa.push(`${c.name} › ${ck.name}`);
        continue;
      }
      const itens = [...(ck.checkItems ?? [])]
        .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
        .map((i) => ({ texto: i.name, feito: i.state === "complete" }));
      const existente = atribuicoes.find((a) => a.pessoa_id === p.id);
      if (existente) existente.itens.push(...itens);
      else atribuicoes.push({ pessoa_id: p.id, papel: atribuicoes.length === 0 ? "responsavel" : "apoio", itens });
    }
    for (const m of c.idMembers ?? []) {
      const p = acharPessoa(membros.get(m) ?? "", pessoas);
      if (p && !atribuicoes.some((a) => a.pessoa_id === p.id))
        atribuicoes.push({ pessoa_id: p.id, papel: atribuicoes.length === 0 ? "responsavel" : "apoio", itens: [] });
    }

    const tarefa: PlanoTarefa = {
      trello_id: c.id,
      titulo: c.name.slice(0, 200),
      descricao: c.desc?.trim() ? c.desc : null,
      status: destino.status,
      semana: destino.semana && numeros.has(destino.semana) ? destino.semana : null,
      prazo: c.due ?? null,
      etiquetas: (c.idLabels ?? [])
        .map((id) => etqPorNome.get(normalizar(etqTrello.get(id) ?? "")))
        .filter((x): x is string => Boolean(x)),
      atribuicoes,
      documentos: links.map((url) => ({ titulo: "Documento do Trello", url })),
    };
    plano.tarefas.push(tarefa);
  }

  plano.totais = {
    tarefas: plano.tarefas.length,
    itens: plano.tarefas.reduce((s, t) => s + t.atribuicoes.reduce((x, a) => x + a.itens.length, 0), 0),
    documentos: plano.tarefas.reduce((s, t) => s + t.documentos.length, 0) + plano.documentosSemana1.length,
  };
  return plano;
}
