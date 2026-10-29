"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { pessoaLogada, type PessoaLogada } from "@/lib/auth";
import { comoUsuario, mensagemDeErro, type Consulta } from "@/lib/banco";
import { buscar, configuracao, semanas as listarSemanas } from "@/lib/painel/dados";
import { fimDaSemanaIso, proximaReuniao } from "@/lib/painel/datas";
import { planejarImportacao, type TrelloJson } from "@/lib/painel/trello";
import type {
  PapelAtribuicao,
  PapelPainel,
  Resultado,
  Status,
  StatusContato,
  StatusSemana,
  TipoDocumento,
} from "@/lib/painel/tipos";

// Ações do painel (server actions). Todas gravam como a pessoa logada, então o
// RLS do banco decide o que é permitido; aqui só traduzimos os erros.

class Recusa extends Error {}

async function agir<T>(fn: (q: Consulta, eu: PessoaLogada) => Promise<T>): Promise<Resultado<T>> {
  const eu = await pessoaLogada();
  if (!eu) return { ok: false, erro: "Sua sessão expirou. Entre de novo." };
  try {
    const dado = await comoUsuario(eu.authId, (q) => fn(q, eu));
    revalidatePath("/painel", "layout");
    return { ok: true, dado };
  } catch (e) {
    return { ok: false, erro: e instanceof Recusa ? e.message : mensagemDeErro(e) };
  }
}

// Quando o RLS esconde a linha, o update não afeta nada: vira recusa.
function exigir<T>(linhas: T[], msg = "Você não tem permissão para fazer isso.") {
  if (!linhas.length) throw new Recusa(msg);
  return linhas[0];
}

function texto(v: unknown, max = 5000) {
  const s = String(v ?? "").trim();
  if (s.length > max) throw new Recusa(`Use no máximo ${max} caracteres.`);
  return s;
}

const URL_DRIVE = /^https:\/\/(drive|docs)\.google\.com\//;

// ---------------------------------------------------------------- tarefas

export type NovaTarefa = {
  titulo: string;
  semana?: number | null;
  prazo?: string | null;
  status?: Status;
  etiquetas?: string[];
  responsaveis?: string[];
  apoio?: string[];
  ligada_entrega?: boolean;
  descricao?: string | null;
  origem?: "manual" | "reuniao";
  reuniao_id?: string | null;
};

export async function criarTarefa(d: NovaTarefa) {
  return agir(async (q, eu) => {
    const titulo = texto(d.titulo, 200);
    if (!titulo) throw new Recusa("Dê um título para a tarefa.");
    const status = d.status ?? "a_fazer";
    const [semana] = d.semana
      ? await q<{ id: string; fim: string }>("select id, fim::text as fim from semana where numero = $1", [d.semana])
      : [];
    const prazo = d.prazo ?? (semana ? fimDaSemanaIso(semana.fim) : null);
    const [t] = await q<{ id: string }>(
      `insert into tarefa (titulo, descricao, status, semana_id, prazo, ligada_entrega, origem, reuniao_id, criado_por, posicao)
       values ($1, $2, $3::status_tarefa, $4, $5, $6, $7::origem_tarefa, $8, $9,
               (select coalesce(max(posicao), 0) + 1 from tarefa where status = $3::status_tarefa))
       returning id`,
      [
        titulo,
        d.descricao ?? null,
        status,
        semana?.id ?? null,
        prazo,
        Boolean(d.ligada_entrega),
        d.origem ?? "manual",
        d.reuniao_id ?? null,
        eu.id,
      ],
    );
    for (const e of d.etiquetas ?? [])
      await q("insert into tarefa_etiqueta (tarefa_id, etiqueta_id) values ($1, $2)", [t.id, e]);
    let pos = 0;
    for (const p of d.responsaveis ?? [])
      await q("insert into atribuicao (tarefa_id, pessoa_id, papel, posicao) values ($1, $2, 'responsavel', $3)", [t.id, p, pos++]);
    for (const p of d.apoio ?? [])
      if (!(d.responsaveis ?? []).includes(p))
        await q("insert into atribuicao (tarefa_id, pessoa_id, papel, posicao) values ($1, $2, 'apoio', $3)", [t.id, p, pos++]);
    return t.id;
  });
}

export type CamposTarefa = {
  titulo?: string;
  descricao?: string | null;
  status?: Status;
  semana?: number | null;
  prazo?: string | null;
  ligada_entrega?: boolean;
  arquivada?: boolean;
};

export async function atualizarTarefa(id: string, c: CamposTarefa) {
  return agir(async (q) => {
    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown, cast = "") => {
      vals.push(v);
      sets.push(`${col} = $${vals.length + 1}${cast}`);
    };
    if (c.titulo !== undefined) {
      const t = texto(c.titulo, 200);
      if (!t) throw new Recusa("O título não pode ficar vazio.");
      add("titulo", t);
    }
    if (c.descricao !== undefined) add("descricao", c.descricao ? texto(c.descricao, 20000) : null);
    if (c.status !== undefined) add("status", c.status, "::status_tarefa");
    if (c.prazo !== undefined) add("prazo", c.prazo);
    if (c.ligada_entrega !== undefined) add("ligada_entrega", c.ligada_entrega);
    if (c.arquivada !== undefined) add("arquivada", c.arquivada);
    if (c.semana !== undefined) {
      if (c.semana === null) add("semana_id", null);
      else {
        const [s] = await q<{ id: string }>("select id from semana where numero = $1", [c.semana]);
        add("semana_id", s?.id ?? null);
      }
    }
    if (!sets.length) return id;
    exigir(await q(`update tarefa set ${sets.join(", ")} where id = $1 returning id`, [id, ...vals]));
    return id;
  });
}

export async function definirEtiquetas(id: string, etiquetaIds: string[]) {
  return agir(async (q) => {
    exigir(await q("select id from tarefa where id = $1", [id]));
    await q("delete from tarefa_etiqueta where tarefa_id = $1", [id]);
    for (const e of etiquetaIds) await q("insert into tarefa_etiqueta (tarefa_id, etiqueta_id) values ($1, $2)", [id, e]);
    return id;
  });
}

// Kanban: muda o status e a posição (seção 9.3).
export async function moverTarefa(id: string, status: Status, posicao: number) {
  return agir(async (q) => {
    exigir(
      await q("update tarefa set status = $2::status_tarefa, posicao = $3 where id = $1 returning id", [id, status, posicao]),
    );
    return id;
  });
}

export async function duplicarTarefa(id: string) {
  return agir(async (q, eu) => {
    const [n] = await q<{ id: string }>(
      `insert into tarefa (titulo, descricao, status, semana_id, prazo, ligada_entrega, origem, criado_por, posicao)
       select left('Cópia de ' || titulo, 200), descricao, 'a_fazer', semana_id, prazo, ligada_entrega, 'manual', $2,
              (select coalesce(max(posicao), 0) + 1 from tarefa where status = 'a_fazer')
         from tarefa where id = $1 returning id`,
      [id, eu.id],
    );
    exigir([n]);
    await q(
      "insert into tarefa_etiqueta (tarefa_id, etiqueta_id) select $2, etiqueta_id from tarefa_etiqueta where tarefa_id = $1",
      [id, n.id],
    );
    const atribs = await q<{ id: string; pessoa_id: string; papel: string; posicao: number }>(
      "select id, pessoa_id, papel::text as papel, posicao from atribuicao where tarefa_id = $1",
      [id],
    );
    for (const a of atribs) {
      const [na] = await q<{ id: string }>(
        "insert into atribuicao (tarefa_id, pessoa_id, papel, posicao) values ($1, $2, $3::papel_atrib, $4) returning id",
        [n.id, a.pessoa_id, a.papel, a.posicao],
      );
      await q(
        "insert into item (atribuicao_id, texto, posicao) select $2, texto, posicao from item where atribuicao_id = $1",
        [a.id, na.id],
      );
    }
    return n.id;
  });
}

// ---------------------------------------------------------------- pessoas na tarefa

export async function atribuir(tarefaId: string, pessoaId: string, papel: PapelAtribuicao = "responsavel") {
  return agir(async (q) => {
    const [a] = await q<{ id: string }>(
      `insert into atribuicao (tarefa_id, pessoa_id, papel, posicao)
       values ($1, $2, $3::papel_atrib, (select coalesce(max(posicao), 0) + 1 from atribuicao where tarefa_id = $1))
       on conflict (tarefa_id, pessoa_id) do update set papel = excluded.papel
       returning id`,
      [tarefaId, pessoaId, papel],
    );
    return a.id;
  });
}

export async function mudarPapel(atribuicaoId: string, papel: PapelAtribuicao) {
  return agir(async (q) => {
    exigir(await q("update atribuicao set papel = $2::papel_atrib where id = $1 returning id", [atribuicaoId, papel]));
  });
}

export async function removerAtribuicao(atribuicaoId: string) {
  return agir(async (q) => {
    exigir(await q("delete from atribuicao where id = $1 returning id", [atribuicaoId]));
  });
}

// ---------------------------------------------------------------- itens

export async function adicionarItem(atribuicaoId: string, textoItem: string) {
  return agir(async (q) => {
    const t = texto(textoItem, 500);
    if (!t) throw new Recusa("Escreva o item.");
    const [i] = await q<{ id: string }>(
      `insert into item (atribuicao_id, texto, posicao)
       values ($1, $2, (select coalesce(max(posicao), 0) + 1 from item where atribuicao_id = $1)) returning id`,
      [atribuicaoId, t],
    );
    return i.id;
  });
}

export async function editarItem(id: string, textoItem: string) {
  return agir(async (q) => {
    const t = texto(textoItem, 500);
    if (!t) throw new Recusa("O item não pode ficar vazio.");
    exigir(await q("update item set texto = $2 where id = $1 returning id", [id, t]));
  });
}

export async function marcarItem(id: string, feito: boolean) {
  return agir(async (q) => {
    exigir(await q("update item set feito = $2 where id = $1 returning id", [id, feito]));
  });
}

export async function removerItem(id: string) {
  return agir(async (q) => {
    exigir(await q("delete from item where id = $1 returning id", [id]));
  });
}

export async function reordenarItens(ids: string[]) {
  return agir(async (q) => {
    let pos = 1;
    for (const id of ids) await q("update item set posicao = $2 where id = $1", [id, pos++]);
  });
}

// ---------------------------------------------------------------- documentos e comentários

export async function adicionarDocumento(d: {
  tarefaId?: string | null;
  semanaId?: string | null;
  titulo: string;
  url: string;
  tipo: TipoDocumento;
}) {
  return agir(async (q) => {
    const url = texto(d.url, 2000);
    if (!URL_DRIVE.test(url)) throw new Recusa("Use um link do Google Drive ou do Google Docs (https://drive.google.com/… ou https://docs.google.com/…).");
    const titulo = texto(d.titulo, 200) || "Documento";
    const [doc] = await q<{ id: string }>(
      "insert into documento (tarefa_id, semana_id, titulo, url, tipo) values ($1, $2, $3, $4, $5::tipo_documento) returning id",
      [d.tarefaId ?? null, d.semanaId ?? null, titulo, url, d.tipo],
    );
    return doc.id;
  });
}

export async function removerDocumento(id: string) {
  return agir(async (q) => {
    exigir(await q("delete from documento where id = $1 returning id", [id]));
  });
}

export async function comentar(tarefaId: string, textoComentario: string) {
  return agir(async (q, eu) => {
    const t = texto(textoComentario, 5000);
    if (!t) throw new Recusa("Escreva o comentário.");
    const [c] = await q<{ id: string }>(
      "insert into comentario (tarefa_id, autor_id, texto) values ($1, $2, $3) returning id",
      [tarefaId, eu.id, t],
    );
    return c.id;
  });
}

export async function apagarComentario(id: string) {
  return agir(async (q) => {
    exigir(await q("delete from comentario where id = $1 returning id", [id]));
  });
}

// ---------------------------------------------------------------- semanas

export async function atualizarSemana(
  id: string,
  c: {
    entrega_titulo?: string | null;
    entrega_prazo?: string | null;
    entrega_url?: string | null;
    status?: StatusSemana;
    anotacoes?: string | null;
    inicio?: string;
    fim?: string;
  },
) {
  return agir(async (q) => {
    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown, cast = "") => {
      vals.push(v);
      sets.push(`${col} = $${vals.length + 1}${cast}`);
    };
    if (c.entrega_titulo !== undefined) add("entrega_titulo", c.entrega_titulo ? texto(c.entrega_titulo, 200) : null);
    if (c.entrega_prazo !== undefined) add("entrega_prazo", c.entrega_prazo);
    if (c.entrega_url !== undefined) add("entrega_url", c.entrega_url ? texto(c.entrega_url, 2000) : null);
    if (c.status !== undefined) add("status", c.status, "::status_semana");
    if (c.anotacoes !== undefined) add("anotacoes", c.anotacoes ? texto(c.anotacoes, 20000) : null);
    if (c.inicio !== undefined) add("inicio", c.inicio, "::date");
    if (c.fim !== undefined) add("fim", c.fim, "::date");
    if (!sets.length) return;
    exigir(await q(`update semana set ${sets.join(", ")} where id = $1 returning id`, [id, ...vals]), "Só o admin edita as semanas.");
  });
}

// Recalcula as 12 semanas a partir do início da semana 1 (Configurações).
export async function recalcularSemanas(inicioSemana1: string) {
  return agir(async (q) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicioSemana1)) throw new Recusa("Data inválida.");
    exigir(
      await q(
        `update semana set inicio = $1::date + (numero - 1) * 7, fim = $1::date + (numero - 1) * 7 + 6 returning id`,
        [inicioSemana1],
      ),
      "Só o admin altera as semanas.",
    );
  });
}

// ---------------------------------------------------------------- reuniões

export async function criarReuniao(dataIso?: string) {
  return agir(async (q) => {
    let data = dataIso ?? null;
    if (!data) {
      const c = await configuracao(q);
      data = proximaReuniao(c.reuniao_dia_semana, c.reuniao_hora)?.toISOString() ?? new Date().toISOString();
    }
    const [r] = await q<{ id: string }>("insert into reuniao (data) values ($1) returning id", [data]);
    return r.id;
  });
}

export async function atualizarReuniao(id: string, c: { anotacoes?: string | null; ata_url?: string | null; data?: string }) {
  return agir(async (q) => {
    if (c.ata_url && !URL_DRIVE.test(c.ata_url)) throw new Recusa("Use um link do Google Drive ou do Google Docs.");
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (c.anotacoes !== undefined) {
      vals.push(c.anotacoes ? texto(c.anotacoes, 50000) : null);
      sets.push(`anotacoes = $${vals.length + 1}`);
    }
    if (c.ata_url !== undefined) {
      vals.push(c.ata_url || null);
      sets.push(`ata_url = $${vals.length + 1}`);
    }
    if (c.data !== undefined) {
      vals.push(c.data);
      sets.push(`data = $${vals.length + 1}`);
    }
    if (!sets.length) return;
    exigir(await q(`update reuniao set ${sets.join(", ")} where id = $1 returning id`, [id, ...vals]));
  });
}

export async function alternarPresenca(reuniaoId: string, pessoaId: string, presente: boolean) {
  return agir(async (q) => {
    if (presente)
      await q("insert into reuniao_presenca (reuniao_id, pessoa_id) values ($1, $2) on conflict do nothing", [reuniaoId, pessoaId]);
    else await q("delete from reuniao_presenca where reuniao_id = $1 and pessoa_id = $2", [reuniaoId, pessoaId]);
  });
}

export async function adicionarDecisao(reuniaoId: string, textoDecisao: string) {
  return agir(async (q) => {
    const t = texto(textoDecisao, 1000);
    if (!t) throw new Recusa("Escreva a decisão.");
    await q(
      `insert into decisao (reuniao_id, texto, posicao)
       values ($1, $2, (select coalesce(max(posicao), 0) + 1 from decisao where reuniao_id = $1))`,
      [reuniaoId, t],
    );
  });
}

export async function removerDecisao(id: string) {
  return agir(async (q) => {
    exigir(await q("delete from decisao where id = $1 returning id", [id]));
  });
}

// ---------------------------------------------------------------- contatos

export async function atualizarContato(
  id: string,
  c: { status?: StatusContato; responsavel_id?: string | null; notas?: string | null },
) {
  return agir(async (q) => {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (c.status !== undefined) {
      vals.push(c.status);
      sets.push(`status = $${vals.length + 1}::status_contato`);
    }
    if (c.responsavel_id !== undefined) {
      vals.push(c.responsavel_id);
      sets.push(`responsavel_id = $${vals.length + 1}`);
    }
    if (c.notas !== undefined) {
      vals.push(c.notas ? texto(c.notas, 10000) : null);
      sets.push(`notas = $${vals.length + 1}`);
    }
    if (!sets.length) return;
    exigir(await q(`update contato set ${sets.join(", ")} where id = $1 returning id`, [id, ...vals]));
  });
}

// ---------------------------------------------------------------- equipe (admin)

export type DadosPessoa = {
  nome: string;
  apelido?: string | null;
  email: string;
  frente?: string | null;
  papel: PapelPainel;
  cor: string;
};

function validarPessoa(d: DadosPessoa) {
  const nome = texto(d.nome, 120);
  const email = texto(d.email, 200).toLowerCase();
  if (!nome) throw new Recusa("Informe o nome.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Recusa("Confira o e-mail.");
  if (!/^#[0-9a-fA-F]{6}$/.test(d.cor)) throw new Recusa("Escolha uma cor.");
  return { nome, email, apelido: d.apelido ? texto(d.apelido, 40) : null, frente: d.frente ? texto(d.frente, 200) : null };
}

export async function criarPessoa(d: DadosPessoa) {
  return agir(async (q) => {
    const v = validarPessoa(d);
    const [p] = await q<{ id: string }>(
      "insert into pessoa (nome, apelido, email, frente, papel, cor) values ($1, $2, $3, $4, $5::papel_painel, $6) returning id",
      [v.nome, v.apelido, v.email, v.frente, d.papel, d.cor],
    );
    return exigir([p], "Só o admin cadastra pessoas.").id;
  });
}

export async function atualizarPessoa(id: string, d: DadosPessoa & { ativo?: boolean }) {
  return agir(async (q) => {
    const v = validarPessoa(d);
    exigir(
      await q(
        `update pessoa set nome = $2, apelido = $3, email = $4, frente = $5, papel = $6::papel_painel, cor = $7,
                ativo = coalesce($8, ativo)
          where id = $1 returning id`,
        [id, v.nome, v.apelido, v.email, v.frente, d.papel, d.cor, d.ativo ?? null],
      ),
      "Só o admin edita pessoas.",
    );
  });
}

export async function definirAtivo(id: string, ativo: boolean) {
  return agir(async (q, eu) => {
    if (id === eu.id && !ativo) throw new Recusa("Você não pode desativar a si mesmo.");
    exigir(await q("update pessoa set ativo = $2 where id = $1 returning id", [id, ativo]), "Só o admin desativa pessoas.");
  });
}

// ---------------------------------------------------------------- configurações (admin)

export async function atualizarConfiguracao(c: {
  reuniao_dia_semana: number | null;
  reuniao_hora: string | null;
  responsavel_contato_id: string | null;
}) {
  return agir(async (q) => {
    exigir(
      await q(
        `update configuracao set reuniao_dia_semana = $1, reuniao_hora = $2::time, responsavel_contato_id = $3
          where id = 1 returning id`,
        [c.reuniao_dia_semana, c.reuniao_hora || null, c.responsavel_contato_id],
      ),
      "Só o admin altera as configurações.",
    );
  });
}

// Token da API do Claude (seção 11.1): "mocca_" + 40 caracteres; só o hash fica no banco.
export async function criarToken(nome: string) {
  return agir(async (q, eu) => {
    const n = texto(nome, 80) || "Claude do projeto";
    const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = randomBytes(40);
    const token = "mocca_" + Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
    const hash = createHash("sha256").update(token).digest("hex");
    exigir(
      await q("insert into token_api (nome, hash, criado_por) values ($1, $2, $3) returning id", [n, hash, eu.id]),
      "Só o admin cria tokens.",
    );
    return token;
  });
}

export async function revogarToken(id: string) {
  return agir(async (q) => {
    exigir(await q("update token_api set revogado = true where id = $1 returning id", [id]), "Só o admin revoga tokens.");
  });
}

// Usado pela paleta de comandos e pela visão da semana.
export async function semanasDisponiveis() {
  const eu = await pessoaLogada();
  if (!eu) return [];
  return comoUsuario(eu.authId, (q) => listarSemanas(q));
}

// ---------------------------------------------------------------- importação do Trello (admin)

export async function importarTrello(json: TrelloJson) {
  return agir(async (q, eu) => {
    if (eu.papel !== "admin") throw new Recusa("Só o admin importa o Trello.");
    const [ps, es, ss] = [
      await q<{ id: string; nome: string; apelido: string | null }>("select id, nome, apelido from pessoa where ativo"),
      await q<{ id: string; nome: string }>("select id, nome from etiqueta"),
      await q<{ id: string; numero: number }>("select id, numero from semana"),
    ];
    const plano = planejarImportacao(json, ps, es, ss);
    const semanaId = new Map(ss.map((s) => [s.numero, s.id]));
    let criadas = 0;
    let puladas = 0;
    let pos = 1;
    for (const t of plano.tarefas) {
      const [nova] = await q<{ id: string }>(
        `insert into tarefa (titulo, descricao, status, semana_id, prazo, origem, trello_id, criado_por, posicao)
         values ($1, $2, $3::status_tarefa, $4, $5, 'trello', $6, $7, $8)
         on conflict (trello_id) do nothing returning id`,
        [t.titulo, t.descricao, t.status, t.semana ? semanaId.get(t.semana) ?? null : null, t.prazo, t.trello_id, eu.id, pos++],
      );
      if (!nova) {
        puladas++;
        continue;
      }
      criadas++;
      for (const e of t.etiquetas)
        await q("insert into tarefa_etiqueta (tarefa_id, etiqueta_id) values ($1, $2) on conflict do nothing", [nova.id, e]);
      let ordem = 0;
      for (const a of t.atribuicoes) {
        const [at] = await q<{ id: string }>(
          "insert into atribuicao (tarefa_id, pessoa_id, papel, posicao) values ($1, $2, $3::papel_atrib, $4) returning id",
          [nova.id, a.pessoa_id, a.papel, ordem++],
        );
        let i = 0;
        for (const item of a.itens)
          await q("insert into item (atribuicao_id, texto, feito, posicao) values ($1, $2, $3, $4)", [at.id, item.texto.slice(0, 500), item.feito, ++i]);
      }
      for (const d of t.documentos)
        await q("insert into documento (tarefa_id, titulo, url, tipo) values ($1, $2, $3, 'outro')", [nova.id, d.titulo, d.url]);
    }
    const s1 = semanaId.get(1);
    if (s1)
      for (const d of plano.documentosSemana1)
        await q(
          `insert into documento (semana_id, titulo, url, tipo)
           select $1, $2, $3, 'outro' where not exists (select 1 from documento where semana_id = $1 and url = $3)`,
          [s1, d.titulo.slice(0, 200), d.url],
        );
    return { criadas, puladas };
  });
}

// ---------------------------------------------------------------- paleta de comandos

// Só leitura: não passa por agir(), que revalida as páginas.
export async function buscarNoPainel(termo: string) {
  const eu = await pessoaLogada();
  const t = String(termo ?? "").trim().slice(0, 100);
  if (!eu || t.length < 2) return { tarefas: [], reunioes: [] };
  return comoUsuario(eu.authId, (q) => buscar(q, t));
}
