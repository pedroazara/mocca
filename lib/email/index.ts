import "server-only";
import { after } from "next/server";
import { comoServico } from "@/lib/banco";
import { linkMinhasTarefas, linkTarefa } from "@/lib/painel/links";
import type { PapelAtribuicao } from "@/lib/painel/tipos";
import {
  confirmacaoContato,
  enderecoDeExemplo,
  lembretesDaVespera,
  pacotesDaSemana,
  SQL_ATRIBUICAO,
  SQL_AVISOS_PENDENTES,
  SQL_LEMBRETES,
  SQL_PACOTE,
  SQL_SEMANA_PACOTE,
  SQL_SITUACAO_PACOTE,
  tarefaAtribuida,
  type Envolvido,
  type LinhaLembrete,
  type LinhaPacote,
  type Mensagem,
  type Registro,
  type SemanaPacote,
} from "./mensagens";

// E-mails automáticos, enviados pela conta do MoCCa no Gmail por um app da Web
// do Apps Script (scripts/enviar-email.gs), que só envia com a chave certa. Sem
// GMAIL_SCRIPT_URL e GMAIL_SCRIPT_CHAVE nada sai, só fica no log. Falha de envio
// nunca desfaz o que foi gravado nem vira erro para quem está usando o site.

const scriptGmail = () => ({ url: process.env.GMAIL_SCRIPT_URL?.trim() ?? "", chave: process.env.GMAIL_SCRIPT_CHAVE?.trim() ?? "" });
export const envioConfigurado = () => {
  const { url, chave } = scriptGmail();
  return Boolean(url && chave);
};

// O Apps Script responde com um redirecionamento para o resultado, que o fetch
// segue; o JSON diz se o Gmail aceitou. Qualquer outra resposta conta como falha.
async function entregar({ url, chave }: ReturnType<typeof scriptGmail>, m: Mensagem) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chave, para: m.para, assunto: m.assunto, texto: m.texto, html: m.html }),
    signal: AbortSignal.timeout(20000),
  });
  const resposta = (await r.json().catch(() => null)) as { ok?: boolean; erro?: string } | null;
  if (resposta?.ok !== true) throw new Error(resposta?.erro ?? `o script respondeu ${r.status} sem JSON`);
}

// O registro de um e-mail aceito. Uma falha aqui só vai para o log: o e-mail já saiu.
async function registrar(r: Registro) {
  try {
    await comoServico((q) =>
      q(
        `insert into email_enviado (tipo, pessoa_id, tarefa_id, semana_id, tarefas)
         values ($1, $2, $3, $4, (select coalesce(array_agg(x::uuid), '{}') from json_array_elements_text($5::json) x))`,
        [
          r.tipo,
          r.pessoa_id,
          r.tipo === "tarefa" ? r.tarefa_id : null,
          r.tipo === "entrega" ? r.semana_id : null,
          JSON.stringify(r.tipo === "entrega" ? r.tarefas : []),
        ],
      ),
    );
  } catch (e) {
    console.error("[email] falha ao registrar o envio:", e);
  }
}

// Devolve os e-mails que o Gmail aceitou de fato: sem a senha, para endereço
// de exemplo ou com falha no envio, não entram. Os que têm registro ficam em
// email_enviado, para o painel mostrar quem já recebeu.
async function enviar(mensagens: Mensagem[]) {
  const script = scriptGmail();
  const validas = mensagens.filter((m) => !enderecoDeExemplo(m.para));
  if (!envioConfigurado()) {
    for (const m of validas) console.info(`[email] sem GMAIL_SCRIPT_URL e GMAIL_SCRIPT_CHAVE, não enviado: "${m.assunto}"`);
    return [];
  }
  const enviadas: Mensagem[] = [];
  for (const m of validas) {
    try {
      await entregar(script, m);
      enviadas.push(m);
    } catch (e) {
      console.error("[email] falha ao enviar:", e);
      continue;
    }
    if (m.registro) await registrar(m.registro);
  }
  return enviadas;
}

// Roda depois da resposta, quando a transação de quem chamou já terminou: o que
// `montar` lê do banco é só o que foi gravado de fato. O `after` mantém a função
// da Vercel viva até o envio acabar; um envio solto seria cortado no meio.
function depoisDaResposta(montar: () => Promise<Mensagem[]>) {
  try {
    after(() => montar().then(enviar).catch((e) => console.error("[email]", e)));
  } catch (e) {
    console.error("[email]", e);
  }
}

// As tarefas ligadas à entrega não têm aviso próprio: vão no pacote da semana.
async function mensagemDeAtribuicao(tarefaId: string, pessoaId: string, autor?: string) {
  const [a] = await comoServico((q) =>
    q<{
      para: string;
      nome: string;
      papel: PapelAtribuicao;
      titulo: string;
      prazo: string | null;
      ligada_entrega: boolean;
      itens: string[];
      semana: { numero: number; total: number } | null;
      etiquetas: { nome: string; token: string }[];
      outros: Envolvido[];
    }>(SQL_ATRIBUICAO, [tarefaId, pessoaId]),
  );
  if (!a || a.ligada_entrega) return [];
  return [
    {
      ...tarefaAtribuida({ ...a, autor, link: linkTarefa(tarefaId) }),
      registro: { tipo: "tarefa", pessoa_id: pessoaId, tarefa_id: tarefaId } as const,
    },
  ];
}

// Quem atribui a si mesmo não recebe aviso.
export function avisarAtribuicao(
  tarefaId: string,
  pessoaId: string,
  autor?: { id: string; nome: string; apelido: string | null },
) {
  if (autor?.id === pessoaId) return;
  depoisDaResposta(() => mensagemDeAtribuicao(tarefaId, pessoaId, autor ? (autor.apelido ?? autor.nome) : undefined));
}

// Formulário do site: confirma para quem escreveu e avisa quem ficou com a
// tarefa "Responder contato", criada por registrar_contato.
export function avisarContatoRecebido(contatoId: string, contato: { nome: string; email: string }) {
  depoisDaResposta(async () => {
    const atribuicoes = await comoServico((q) =>
      q<{ tarefa_id: string; pessoa_id: string }>(
        "select a.tarefa_id, a.pessoa_id from atribuicao a join tarefa t on t.id = a.tarefa_id where t.contato_id = $1",
        [contatoId],
      ),
    );
    const avisos = await Promise.all(atribuicoes.map((a) => mensagemDeAtribuicao(a.tarefa_id, a.pessoa_id)));
    // No máximo uma confirmação por endereço a cada 24 h: qualquer um pode digitar
    // o e-mail de outra pessoa no formulário (DUVIDAS 28).
    const [anterior] = await comoServico((q) =>
      q<{ n: number }>(
        `select count(*)::int as n from contato
          where lower(email) = lower($1) and id <> $2 and criado_em > now() - interval '24 hours'`,
        [contato.email, contatoId],
      ),
    );
    const confirmacao = anterior?.n ? [] : [confirmacaoContato({ para: contato.email, nome: contato.nome })];
    return [...confirmacao, ...avisos.flat()];
  });
}

// Lembrete da véspera (fase 4), chamado pela rota agendada /api/cron/lembretes:
// cada pessoa recebe um e-mail só, com as tarefas abertas dela que vencem no dia.
export async function enviarLembretes(dia: string) {
  const linhas = await comoServico((q) => q<LinhaLembrete>(SQL_LEMBRETES, [dia]));
  const mensagens = lembretesDaVespera(linhas, linkTarefa);
  // "emails": os montados, um por pessoa; "enviados": os que o Gmail aceitou
  const enviados = (await enviar(mensagens)).length;
  return { tarefas: new Set(linhas.map((l) => l.tarefa_id)).size, emails: mensagens.length, enviados };
}

// Botão "Enviar" da janela da tarefa: o aviso para quem dela ainda não recebeu.
// Devolve os nomes de quem recebeu agora e de quem ficou sem (falha no envio).
export async function enviarAvisosPendentes(tarefaId: string) {
  const pendentes = await comoServico((q) => q<{ pessoa_id: string; nome: string }>(SQL_AVISOS_PENDENTES, [tarefaId]));
  const mensagens = (await Promise.all(pendentes.map((p) => mensagemDeAtribuicao(tarefaId, p.pessoa_id)))).flat();
  const enviadas = new Set((await enviar(mensagens)).map((m) => m.registro?.pessoa_id));
  return separar(pendentes, enviadas);
}

// Botão do pacote na tela Semana: o pacote da entrega para quem tem alguma
// tarefa dele que ainda não foi em nenhum pacote. Quem recebe de novo ganha o
// pacote inteiro, com as tarefas novas junto.
export async function enviarPacote(semanaId: string) {
  const { semana, situacao, linhas } = await comoServico(async (q) => ({
    semana: (await q<SemanaPacote>(SQL_SEMANA_PACOTE, [semanaId]))[0],
    situacao: await q<{ pessoa_id: string; nome: string; tem_email: boolean; falta: boolean }>(SQL_SITUACAO_PACOTE, [semanaId]),
    linhas: await q<LinhaPacote>(SQL_PACOTE, [semanaId]),
  }));
  const pendentes = situacao.filter((s) => s.falta && s.tem_email);
  if (!semana || !pendentes.length) return { enviados: [], falharam: [] };
  const ids = new Set(pendentes.map((p) => p.pessoa_id));
  const mensagens = pacotesDaSemana(
    semana,
    linhas.filter((l) => ids.has(l.pessoa_id)),
    { tarefa: linkTarefa, painel: linkMinhasTarefas() },
  );
  const enviadas = new Set((await enviar(mensagens)).map((m) => m.registro?.pessoa_id));
  return separar(pendentes, enviadas);
}

function separar(pessoas: { pessoa_id: string; nome: string }[], enviadas: Set<string | undefined>) {
  return {
    enviados: pessoas.filter((p) => enviadas.has(p.pessoa_id)).map((p) => p.nome),
    falharam: pessoas.filter((p) => !enviadas.has(p.pessoa_id)).map((p) => p.nome),
  };
}
