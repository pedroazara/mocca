import { dataCurta, textoPrazo } from "@/lib/painel/datas";
import type { PapelAtribuicao } from "@/lib/painel/tipos";

// Textos dos e-mails automáticos, sem nada de servidor: quem envia é lib/email.

export type Mensagem = { para: string; assunto: string; texto: string; html: string };

// Os e-mails do seed são @exemplo.com, um domínio que pode ter dono de verdade.
// Enquanto a equipe não preencher os reais, nada sai para lá.
export const enderecoDeExemplo = (para: string) => /@exemplo\.com$/i.test(para.trim());

// Dados do aviso de uma atribuição ($1 = tarefa, $2 = pessoa). Pessoa inativa não recebe.
export const SQL_ATRIBUICAO = `
  select p.email as para, coalesce(p.apelido, p.nome) as nome, a.papel::text as papel, t.titulo, t.prazo,
         coalesce((select json_agg(i.texto order by i.posicao, i.id) from item i where i.atribuicao_id = a.id), '[]'::json) as itens
    from atribuicao a
    join pessoa p on p.id = a.pessoa_id
    join tarefa t on t.id = a.tarefa_id
   where a.tarefa_id = $1 and a.pessoa_id = $2 and p.ativo`;

const ENTIDADES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ENTIDADES[c]);

const corpoHtml = (conteudo: string) =>
  `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#2b211b">${conteudo}</div>`;

export function tarefaAtribuida(d: {
  para: string;
  nome: string;
  titulo: string;
  papel: PapelAtribuicao;
  prazo: string | null;
  itens: string[];
  autor?: string | null;
  link: string;
}): Mensagem {
  const abertura = d.autor ? `${d.autor} atribuiu uma tarefa a você no painel do MoCCa.` : "Você recebeu uma tarefa no painel do MoCCa.";
  const papel = d.papel === "responsavel" ? "responsável" : "apoio";
  const prazo = d.prazo ? `${dataCurta(d.prazo)} (${textoPrazo(d.prazo)})` : null;

  const texto = [
    `Olá, ${d.nome}.`,
    "",
    abertura,
    "",
    d.titulo,
    `Papel: ${papel}`,
    ...(prazo ? [`Prazo: ${prazo}`] : []),
    ...(d.itens.length ? ["", "Seus itens:", ...d.itens.map((i) => `- ${i}`)] : []),
    "",
    `Abrir a tarefa: ${d.link}`,
  ].join("\n");

  const html = corpoHtml(
    [
      `<p>Olá, ${escapar(d.nome)}.</p>`,
      `<p>${escapar(abertura)}</p>`,
      `<p><strong>${escapar(d.titulo)}</strong><br>Papel: ${papel}${prazo ? `<br>Prazo: ${escapar(prazo)}` : ""}</p>`,
      d.itens.length ? `<p>Seus itens:</p><ul>${d.itens.map((i) => `<li>${escapar(i)}</li>`).join("")}</ul>` : "",
      `<p><a href="${escapar(d.link)}">Abrir a tarefa</a></p>`,
    ].join(""),
  );

  return { para: d.para, assunto: `Nova tarefa no MoCCa: ${d.titulo}`, texto, html };
}

// O endereço vem de um formulário público, e qualquer um pode digitar o de outra
// pessoa. Por isso o texto é fixo: não repete a mensagem enviada e só usa o nome
// se ele for uma palavra, para o MoCCa não servir de canal de spam.
export function confirmacaoContato(d: { para: string; nome: string }): Mensagem {
  const primeiro = d.nome.trim().split(/\s+/)[0];
  const saudacao = /^\p{L}[\p{L}'-]{1,39}$/u.test(primeiro) ? `Olá, ${primeiro}.` : "Olá.";
  const linhas = [
    "Recebemos sua mensagem pelo site do MoCCa. Alguém da equipe vai responder neste e-mail.",
    "Se não foi você quem enviou, pode ignorar este e-mail.",
    "Equipe MoCCa",
  ];
  return {
    para: d.para,
    assunto: "Recebemos sua mensagem",
    texto: [saudacao, ...linhas].join("\n\n"),
    html: corpoHtml([saudacao, ...linhas].map((l) => `<p>${escapar(l)}</p>`).join("")),
  };
}
