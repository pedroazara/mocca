import "server-only";
import { after } from "next/server";
import nodemailer from "nodemailer";
import { EMAIL_MOCCA } from "@/components/publico/navegacao";
import { comoServico } from "@/lib/banco";
import { linkTarefa } from "@/lib/painel/links";
import type { PapelAtribuicao } from "@/lib/painel/tipos";
import { confirmacaoContato, enderecoDeExemplo, SQL_ATRIBUICAO, tarefaAtribuida, type Mensagem } from "./mensagens";

// E-mails automáticos, enviados pela conta do MoCCa no Gmail (SMTP com senha de
// app). Sem GMAIL_APP_PASSWORD nada sai, só fica no log. Falha de envio nunca
// desfaz o que foi gravado nem vira erro para quem está usando o site.

async function enviar(mensagens: Mensagem[]) {
  const senha = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  const validas = mensagens.filter((m) => !enderecoDeExemplo(m.para));
  if (!senha) {
    for (const m of validas) console.info(`[email] sem GMAIL_APP_PASSWORD, não enviado: "${m.assunto}"`);
    return;
  }
  const transporte = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: EMAIL_MOCCA, pass: senha },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  for (const m of validas) {
    try {
      await transporte.sendMail({ from: `MoCCa <${EMAIL_MOCCA}>`, to: m.para, subject: m.assunto, text: m.texto, html: m.html });
    } catch (e) {
      console.error("[email] falha ao enviar:", e);
    }
  }
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

async function mensagemDeAtribuicao(tarefaId: string, pessoaId: string, autor?: string) {
  const [a] = await comoServico((q) =>
    q<{ para: string; nome: string; papel: PapelAtribuicao; titulo: string; prazo: string | null; itens: string[] }>(SQL_ATRIBUICAO, [
      tarefaId,
      pessoaId,
    ]),
  );
  return a ? [tarefaAtribuida({ ...a, autor, link: linkTarefa(tarefaId) })] : [];
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
    return [confirmacaoContato({ para: contato.email, nome: contato.nome }), ...avisos.flat()];
  });
}
