// Regras puras do painel: datas no fuso de Brasília, pauta da reunião,
// resolução de pessoa da API do Claude e plano de importação do Trello.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolverPessoa, type PessoaApi } from "@/lib/api/pessoas";
import { comPerfil, estudantes, orientador } from "@/lib/equipe";
import {
  deCampoData,
  estaAtrasada,
  fimDaSemanaIso,
  hojeBrasilia,
  proximaReuniao,
  semanaAtual,
  semanaDoDia,
  textoPrazo,
} from "@/lib/painel/datas";
import { montarPauta, reuniaoAnteriorA } from "@/lib/painel/pauta";
import { ehJpegBase64, normalizarLinkedin } from "@/lib/painel/perfil";
import type { Contato, Semana, TarefaResumo } from "@/lib/painel/tipos";
import { acharPessoa, planejarImportacao, type TrelloJson } from "@/lib/painel/trello";

const semana = (numero: number, inicio: string, fim: string): Semana => ({
  id: `s${numero}`,
  numero,
  inicio,
  fim,
  entrega_titulo: `Entrega da semana ${numero}`,
  entrega_prazo: null,
  entrega_url: null,
  status: "nao_iniciada",
  anotacoes: null,
});

const SEMANAS = [semana(2, "2026-10-27", "2026-11-02"), semana(1, "2026-10-20", "2026-10-26"), semana(3, "2026-11-03", "2026-11-09")];

describe("datas", () => {
  it("usa o dia de Brasília, não o de UTC", () => {
    expect(hojeBrasilia(new Date("2026-10-30T02:30:00Z"))).toBe("2026-10-29");
    expect(hojeBrasilia(new Date("2026-10-30T03:00:00Z"))).toBe("2026-10-30");
  });

  it("acha a semana do programa, com as pontas presas à primeira e à última", () => {
    expect(semanaDoDia(SEMANAS, "2026-10-29")?.numero).toBe(2);
    expect(semanaDoDia(SEMANAS, "2026-10-26")?.numero).toBe(1);
    expect(semanaDoDia(SEMANAS, "2026-11-03")?.numero).toBe(3);
    expect(semanaDoDia(SEMANAS, "2026-01-01")?.numero).toBe(1);
    expect(semanaDoDia(SEMANAS, "2027-01-01")?.numero).toBe(3);
    expect(semanaDoDia([], "2026-10-29")).toBeNull();
    // a semana vira à meia-noite de Brasília (03:00 em UTC)
    expect(semanaAtual(SEMANAS, new Date("2026-11-03T03:30:00Z"))?.numero).toBe(3);
    expect(semanaAtual(SEMANAS, new Date("2026-11-03T02:30:00Z"))?.numero).toBe(2);
  });

  it("prazo padrão é o fim do dia em Brasília", () => {
    expect(fimDaSemanaIso("2026-11-02")).toBe("2026-11-03T02:59:00.000Z");
    expect(deCampoData("2026-10-31")).toBe("2026-11-01T02:59:00.000Z");
    expect(deCampoData("")).toBeNull();
  });

  it("descreve o prazo em dias de calendário", () => {
    const agora = new Date("2026-10-29T15:00:00Z"); // quinta, 12h em Brasília
    expect(textoPrazo("2026-10-30T02:59:00Z", agora)).toBe("vence hoje");
    expect(textoPrazo("2026-10-31T02:59:00Z", agora)).toBe("falta 1 dia");
    expect(textoPrazo("2026-11-03T02:59:00Z", agora)).toBe("faltam 4 dias");
    expect(textoPrazo("2026-10-29T02:59:00Z", agora)).toBe("atrasada desde ontem");
    expect(textoPrazo("2026-10-26T15:00:00Z", agora)).toBe("atrasada há 3 dias");
  });

  it("tarefa feita nunca está atrasada", () => {
    const agora = new Date("2026-10-29T15:00:00Z");
    expect(estaAtrasada({ prazo: "2026-10-28T15:00:00Z", status: "fazendo" }, agora)).toBe(true);
    expect(estaAtrasada({ prazo: "2026-10-28T15:00:00Z", status: "feito" }, agora)).toBe(false);
    expect(estaAtrasada({ prazo: null, status: "a_fazer" }, agora)).toBe(false);
  });

  it("calcula a próxima reunião semanal", () => {
    // quarta, 12h em Brasília -> quinta 18h
    expect(proximaReuniao(4, "18:00", new Date("2026-10-28T15:00:00Z"))?.getTime()).toBe(Date.parse("2026-10-29T21:00:00Z"));
    // quinta, 19h em Brasília (reunião já passou) -> quinta seguinte
    expect(proximaReuniao(4, "18:00", new Date("2026-10-29T22:00:00Z"))?.getTime()).toBe(Date.parse("2026-11-05T21:00:00Z"));
    expect(proximaReuniao(null, "18:00")).toBeNull();
  });
});

const tarefa = (t: Partial<TarefaResumo> & { id: string }): TarefaResumo => ({
  titulo: t.id,
  status: "a_fazer",
  posicao: 0,
  prazo: null,
  ligada_entrega: false,
  origem: "manual",
  semana_id: null,
  semana: null,
  etiquetas: [],
  atribuicoes: [],
  documentos: 0,
  comentarios: 0,
  concluido_em: null,
  criado_em: "2026-10-20T12:00:00Z",
  ...t,
});

describe("pauta da reunião", () => {
  const tarefas = [
    tarefa({ id: "entrega", ligada_entrega: true, semana: 2 }),
    tarefa({ id: "entrega-outra-semana", ligada_entrega: true, semana: 1, status: "feito", concluido_em: "2026-10-21T12:00:00Z" }),
    tarefa({ id: "atrasada", prazo: "2026-10-27T02:59:00Z", status: "fazendo" }),
    tarefa({ id: "feita-na-semana", status: "feito", concluido_em: "2026-10-25T12:00:00Z" }),
    tarefa({ id: "feita-depois-da-reuniao", status: "feito", concluido_em: "2026-10-29T22:00:00Z" }),
  ];
  const contatos = [{ id: "c1", status: "novo" }, { id: "c2", status: "respondido" }] as Contato[];

  it("monta os quatro blocos", () => {
    const pauta = montarPauta({
      semanas: SEMANAS,
      tarefas,
      contatos,
      dataReuniao: "2026-10-29T21:00:00Z",
      reuniaoAnterior: "2026-10-22T21:00:00Z",
      agora: new Date("2026-10-29T15:00:00Z"),
    });
    expect(pauta.semana?.numero).toBe(2);
    expect(pauta.entrega.map((t) => t.id)).toEqual(["entrega"]);
    expect(pauta.atrasadas.map((t) => t.id)).toEqual(["atrasada"]);
    expect(pauta.concluidas.map((t) => t.id)).toEqual(["feita-na-semana"]);
    expect(pauta.contatosNovos.map((c) => c.id)).toEqual(["c1"]);
  });

  it("sem reunião anterior, conta tudo o que foi concluído até agora", () => {
    const pauta = montarPauta({
      semanas: SEMANAS,
      tarefas,
      contatos: [],
      dataReuniao: "2026-10-29T21:00:00Z",
      reuniaoAnterior: null,
      agora: new Date("2026-10-29T15:00:00Z"),
    });
    expect(pauta.concluidas.map((t) => t.id)).toEqual(["entrega-outra-semana", "feita-na-semana"]);
  });

  it("acha a reunião anterior", () => {
    const reunioes = [{ data: "2026-10-15T21:00:00Z" }, { data: "2026-10-22T21:00:00Z" }, { data: "2026-10-29T21:00:00Z" }];
    expect(reuniaoAnteriorA(reunioes, "2026-10-29T21:00:00Z")).toBe("2026-10-22T21:00:00.000Z");
    expect(reuniaoAnteriorA(reunioes, "2026-10-15T21:00:00Z")).toBeNull();
  });
});

const EQUIPE: PessoaApi[] = [
  { id: "g", nome: "Gabriel Leonardo", apelido: "Gabriel", email: "gabriel.leonardo@exemplo.com", frente: null },
  { id: "p", nome: "Pedro Henrique", apelido: "Pedro", email: "pedro.henrique@exemplo.com", frente: null },
  { id: "l", nome: "Lucas Pinotti", apelido: "Pinotti", email: "lucas.pinotti@exemplo.com", frente: null },
  { id: "h", nome: "Henrique Perez", apelido: "Henrique", email: "henrique.perez@exemplo.com", frente: null },
  { id: "o", nome: "Prof. Leomar Santos", apelido: "Leomar", email: "leomar.santos@exemplo.com", frente: null },
];

describe("resolução de pessoa (API)", () => {
  const achou = (ref: string, lista = EQUIPE) => {
    const r = resolverPessoa(ref, lista);
    return r.ok ? r.pessoa.id : r.motivo;
  };

  it("aceita id, e-mail e apelido, sem diferenciar maiúsculas", () => {
    expect(achou("l")).toBe("l");
    expect(achou("PEDRO.HENRIQUE@exemplo.com")).toBe("p");
    expect(achou("pinotti")).toBe("l");
  });

  it("o apelido vence o sobrenome de outra pessoa", () => {
    // "Henrique" é apelido do Henrique Perez e sobrenome do Pedro Henrique
    expect(achou("henrique")).toBe("h");
  });

  it("aceita nome completo, primeiro nome e nome sem o título", () => {
    expect(achou("Lucas Pinotti")).toBe("l");
    expect(achou("lucas")).toBe("l");
    expect(achou("leomar santos")).toBe("o");
  });

  it("ignora acentos", () => {
    const comAcento = [...EQUIPE, { id: "j", nome: "João Araújo", apelido: null, email: "joao@exemplo.com", frente: null }];
    expect(achou("joao araujo", comAcento)).toBe("j");
  });

  it("devolve ambígua ou inexistente com as candidatas", () => {
    const doisPedros = [
      { id: "a", nome: "Pedro Alves", apelido: null, email: "a@x.com", frente: null },
      { id: "b", nome: "Pedro Braga", apelido: null, email: "b@x.com", frente: null },
    ];
    const r = resolverPessoa("pedro", doisPedros);
    expect(r).toMatchObject({ ok: false, motivo: "ambigua" });
    expect(!r.ok && r.candidatas.map((p) => p.id)).toEqual(["a", "b"]);
    expect(achou("Fulano")).toBe("inexistente");
    expect(achou("  ")).toBe("inexistente");
  });
});

describe("importação do Trello", () => {
  const pessoas = EQUIPE.map(({ id, nome, apelido }) => ({ id, nome, apelido }));
  const etiquetas = [
    { id: "et-val", nome: "Validação do Produto" },
    { id: "et-tec", nome: "Técnico" },
  ];
  const json: TrelloJson = {
    lists: [
      { id: "L1", name: "Semana 1" },
      { id: "L9", name: "Semana 9" },
      { id: "LA", name: "Em andamento" },
      { id: "LF", name: "Finalizados" },
      { id: "LK", name: "Links" },
      { id: "LX", name: "Ideias soltas" },
      { id: "LC", name: "Semana 2", closed: true },
    ],
    labels: [
      { id: "lb1", name: "validacao do produto" },
      { id: "lb2", name: "Sem correspondência" },
    ],
    members: [{ id: "m1", fullName: "Lucas Pinotti" }],
    cards: [
      {
        id: "c2",
        name: "Entrevistas com produtores",
        desc: "Roteiro: https://docs.google.com/document/d/abc e de novo https://docs.google.com/document/d/abc",
        idList: "L1",
        idLabels: ["lb1", "lb2"],
        idMembers: ["m1"],
        due: "2026-10-24T21:00:00.000Z",
        pos: 2,
      },
      { id: "c1", name: "Primeiro cartão", idList: "L1", pos: 1 },
      { id: "c3", name: "Semana que não existe", idList: "L9", pos: 3 },
      { id: "c4", name: "Protótipo", idList: "LA", pos: 4 },
      { id: "c5", name: "Pitch", idList: "LF", pos: 5 },
      { id: "c6", name: "Pasta do Drive https://drive.google.com/drive/folders/xyz", idList: "LK" },
      { id: "c7", name: "Fora do escopo", idList: "LX" },
      { id: "c8", name: "Arquivado", idList: "L1", closed: true },
      { id: "c9", name: "Em lista fechada", idList: "LC" },
    ],
    checklists: [
      { id: "k2", name: "Marcos", idCard: "c2", pos: 2, checkItems: [{ name: "Planilha", state: "incomplete" }] },
      {
        id: "k1",
        name: "pedro",
        idCard: "c2",
        pos: 1,
        checkItems: [
          { name: "Agendar", state: "complete", pos: 1 },
          { name: "Conduzir", state: "incomplete", pos: 2 },
        ],
      },
      { id: "k3", name: "Fulano", idCard: "c2", pos: 3, checkItems: [{ name: "Sumiu", state: "incomplete" }] },
    ],
  };
  const comMarcos = [...pessoas, { id: "m", nome: "Marcos Ferreira", apelido: "Marcos" }];
  const plano = planejarImportacao(json, comMarcos, etiquetas, [{ numero: 1 }, { numero: 2 }]);

  it("leva só as listas conhecidas, na ordem do quadro", () => {
    expect(plano.tarefas.map((t) => t.trello_id)).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    expect(plano.tarefas.map((t) => t.status)).toEqual(["a_fazer", "a_fazer", "a_fazer", "fazendo", "feito"]);
    expect(plano.tarefas.find((t) => t.trello_id === "c3")?.semana).toBeNull();
    expect(plano.tarefas.find((t) => t.trello_id === "c1")?.semana).toBe(1);
  });

  it("checklist com nome de pessoa vira atribuição; o primeiro é o responsável", () => {
    const t = plano.tarefas.find((x) => x.trello_id === "c2")!;
    expect(t.atribuicoes).toEqual([
      { pessoa_id: "p", papel: "responsavel", itens: [{ texto: "Agendar", feito: true }, { texto: "Conduzir", feito: false }] },
      { pessoa_id: "m", papel: "apoio", itens: [{ texto: "Planilha", feito: false }] },
      { pessoa_id: "l", papel: "apoio", itens: [] },
    ]);
    expect(plano.checklistsSemPessoa).toEqual(["Entrevistas com produtores › Fulano"]);
  });

  it("casa etiquetas pelo nome e guarda links do Drive como documentos", () => {
    const t = plano.tarefas.find((x) => x.trello_id === "c2")!;
    expect(t.etiquetas).toEqual(["et-val"]);
    expect(t.prazo).toBe("2026-10-24T21:00:00.000Z");
    expect(t.documentos).toEqual([{ titulo: "Documento do Trello", url: "https://docs.google.com/document/d/abc" }]);
    expect(plano.documentosSemana1).toEqual([{ titulo: "Pasta do Drive", url: "https://drive.google.com/drive/folders/xyz" }]);
    expect(plano.totais).toEqual({ tarefas: 5, itens: 3, documentos: 2 });
  });

  it("acha a pessoa por apelido, nome ou primeiro nome", () => {
    expect(acharPessoa("PINOTTI", pessoas)?.id).toBe("l");
    expect(acharPessoa("Gabriel Leonardo", pessoas)?.id).toBe("g");
    expect(acharPessoa("Lucas", pessoas)?.id).toBe("l");
    expect(acharPessoa("Leomar", pessoas)?.id).toBe("o");
    expect(acharPessoa("", pessoas)).toBeUndefined();
  });
});

describe("perfil da página Equipe", () => {
  it("normaliza o link do LinkedIn e recusa o resto", () => {
    expect(normalizarLinkedin(" linkedin.com/in/fulano ")).toBe("https://linkedin.com/in/fulano");
    expect(normalizarLinkedin("http://br.linkedin.com/in/fulano/?trk=x#y")).toBe("https://br.linkedin.com/in/fulano/");
    expect(normalizarLinkedin("https://WWW.LinkedIn.com/in/Fulano")).toBe("https://www.linkedin.com/in/Fulano");
    for (const v of [
      "javascript:alert(1)",
      "https://exemplo.com/in/fulano",
      "https://linkedin.com.exemplo.com/in/fulano",
      "https://linkedin.com@exemplo.com/in/fulano",
      "https://linkedin.com:8080/in/fulano",
      "https://linkedin.com",
    ])
      expect(normalizarLinkedin(v)).toBeNull();
  });

  it("só aceita JPEG como foto", () => {
    expect(ehJpegBase64("/9j/4AAQSkZJRg==")).toBe(true);
    expect(ehJpegBase64(btoa("<svg onload=alert(1)>"))).toBe(false);
    expect(ehJpegBase64("/9j/<script>")).toBe(false);
  });

  it("cruza o cartão do site com a pessoa do painel pelo nome", () => {
    const perfil = { pessoa_id: "1", nome: "GABRIEL Leonardo", linkedin: "https://linkedin.com/in/g", foto_url: "/api/fotos/1?v=2" };
    const [gabriel, pedro] = estudantes;
    expect(comPerfil(gabriel, [perfil])).toMatchObject({ linkedin: perfil.linkedin, foto: perfil.foto_url, frase: gabriel.frase });
    expect(comPerfil(pedro, [perfil])).toBe(pedro);
  });

  it("todo cartão do site tem uma pessoa de mesmo nome no seed", () => {
    const seed = readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8");
    for (const p of [...estudantes, orientador]) expect(seed).toContain(`('${p.nome}'`);
  });
});
