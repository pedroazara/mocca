import { COORDENADA_LAVRAS } from "@/components/publico/navegacao";
import { dataCurta, diaDaSemana, diasAtePrazo, paraCampoData, textoPrazo } from "@/lib/painel/datas";
import { imagemEmail } from "@/lib/painel/links";
import type { PapelAtribuicao } from "@/lib/painel/tipos";
import { coresEtiquetas, marca, temaClaro } from "@/lib/tokens";
import { iniciais } from "@/lib/utils";

// Textos dos e-mails automáticos, sem nada de servidor: quem envia é lib/email.

// O que fica gravado em email_enviado quando o Gmail aceita a mensagem: o aviso
// de uma tarefa ou o pacote da entrega de uma semana, com as tarefas que foram nele.
export type Registro =
  | { tipo: "tarefa"; pessoa_id: string; tarefa_id: string }
  | { tipo: "entrega"; pessoa_id: string; semana_id: string; tarefas: string[] };

export type Mensagem = { para: string; assunto: string; texto: string; html: string; registro?: Registro };

// Quem mais está numa tarefa, para o "junto com você" dos e-mails.
export type Envolvido = { nome: string; apelido: string | null; cor: string; papel: PapelAtribuicao };

export { enderecoDeExemplo } from "./exemplo";

// As demais pessoas ativas da tarefa t, fora a pessoa p, responsáveis primeiro.
const SQL_OUTROS = `
  coalesce((select json_agg(json_build_object('nome', o.nome, 'apelido', o.apelido, 'cor', o.cor, 'papel', x.papel) order by x.papel, o.nome)
              from atribuicao x join pessoa o on o.id = x.pessoa_id
             where x.tarefa_id = t.id and x.pessoa_id <> p.id and o.ativo), '[]'::json)`;

// Dados do aviso de uma atribuição ($1 = tarefa, $2 = pessoa). Pessoa inativa não recebe.
export const SQL_ATRIBUICAO = `
  select p.email as para, coalesce(p.apelido, p.nome) as nome, a.papel::text as papel, t.titulo, t.prazo, t.ligada_entrega,
         coalesce((select json_agg(i.texto order by i.posicao, i.id) from item i where i.atribuicao_id = a.id), '[]'::json) as itens,
         case when s.id is not null then json_build_object('numero', s.numero, 'total', (select count(*)::int from semana)) end as semana,
         coalesce((select json_agg(json_build_object('nome', e.nome, 'token', e.token) order by e.nome)
                     from tarefa_etiqueta te join etiqueta e on e.id = te.etiqueta_id
                    where te.tarefa_id = t.id), '[]'::json) as etiquetas,
         ${SQL_OUTROS} as outros
    from atribuicao a
    join pessoa p on p.id = a.pessoa_id
    join tarefa t on t.id = a.tarefa_id
    left join semana s on s.id = t.semana_id
   where a.tarefa_id = $1 and a.pessoa_id = $2 and p.ativo`;

// Quem da tarefa $1 ainda não recebeu o aviso dela (e tem e-mail de verdade).
export const SQL_AVISOS_PENDENTES = `
  select a.pessoa_id, coalesce(p.apelido, p.nome) as nome
    from atribuicao a join pessoa p on p.id = a.pessoa_id
   where a.tarefa_id = $1 and p.ativo and p.email !~* '@exemplo\\.com$'
     and not exists (select 1 from email_enviado e
                      where e.tipo = 'tarefa' and e.tarefa_id = a.tarefa_id and e.pessoa_id = a.pessoa_id)
   order by a.papel, p.nome`;

// As tarefas do pacote da entrega: abertas, ligadas à entrega da semana $1.
const TAREFAS_DO_PACOTE = `
    from tarefa t
    join atribuicao a on a.tarefa_id = t.id
    join pessoa p on p.id = a.pessoa_id
   where t.semana_id = $1 and t.ligada_entrega and not t.arquivada and t.status <> 'feito' and p.ativo`;

// Uma linha por pessoa e tarefa do pacote ($1 = semana), com os itens dela ainda abertos.
export const SQL_PACOTE = `
  select p.id as pessoa_id, p.email as para, coalesce(p.apelido, p.nome) as nome,
         t.id as tarefa_id, t.titulo, t.prazo, a.papel::text as papel,
         coalesce((select json_agg(i.texto order by i.posicao, i.id) from item i
                    where i.atribuicao_id = a.id and not i.feito), '[]'::json) as itens,
         ${SQL_OUTROS} as outros
  ${TAREFAS_DO_PACOTE}
   order by p.email, t.prazo nulls last, t.titulo`;

// A semana do pacote ($1), com o link da entrega: o da semana ou, sem ele, o
// documento "entregável" da semana ou de uma tarefa dela.
export const SQL_SEMANA_PACOTE = `
  select s.id, s.numero, (select count(*)::int from semana) as total, s.entrega_titulo, s.entrega_prazo,
         coalesce(s.entrega_url,
                  (select d.url from documento d
                    where d.tipo = 'entregavel'
                      and (d.semana_id = s.id or d.tarefa_id in (select id from tarefa where semana_id = s.id and not arquivada))
                    order by d.criado_em limit 1)) as entrega_url
    from semana s where s.id = $1`;

// Situação do pacote ($1 = semana), por pessoa com tarefa no pacote: quando
// recebeu o último e se alguma tarefa dela ainda não foi em nenhum pacote.
export const SQL_SITUACAO_PACOTE = `
  select p.id as pessoa_id, coalesce(p.apelido, p.nome) as nome, p.email !~* '@exemplo\\.com$' as tem_email,
         (select max(e.enviado_em) from email_enviado e
           where e.tipo = 'entrega' and e.semana_id = $1 and e.pessoa_id = p.id) as enviado_em,
         exists (select 1 from unnest(array_agg(t.id)) as atual(id)
                  where not exists (select 1 from email_enviado e
                                     where e.tipo = 'entrega' and e.semana_id = $1 and e.pessoa_id = p.id
                                       and atual.id = any(e.tarefas))) as falta
  ${TAREFAS_DO_PACOTE}
   group by p.id
   order by coalesce(p.apelido, p.nome)`;

const ENTIDADES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ENTIDADES[c]);

const corpoHtml = (conteudo: string) =>
  `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#2b211b">${conteudo}</div>`;

const nomePapel = (p: PapelAtribuicao) => (p === "responsavel" ? "responsável" : "apoio");

// ---------------------------------------------------------------------------
// Peças do HTML. O Gmail não carrega fonte da web nem mostra SVG ou imagem de
// fundo: o layout é de tabelas com estilo inline, as fontes da marca caem para
// as do sistema e o único desenho é a faixa do topo (scripts/gerar-cabecalho-email.mjs).

const C = { ...temaClaro, espresso: marca.espresso, caramelo: marca.caramelo, creme: marca.creme };
const TITULO = "'Sora','Segoe UI',Helvetica,Arial,sans-serif";
const TEXTO = "'Public Sans','Segoe UI',Helvetica,Arial,sans-serif";
const DADO = "'JetBrains Mono',Menlo,Consolas,'Courier New',monospace";

const fonte = (familia: string, px: number, peso = 400, altura: number | string = 1.5) =>
  `font-family:${familia};font-size:${px}px;font-weight:${peso};line-height:${altura}`;

const ponto = (cor: string, tamanho = 6) =>
  `<span style="display:inline-block;width:${tamanho}px;height:${tamanho}px;border-radius:${tamanho}px;background:${escapar(cor)};vertical-align:middle"></span>`;

const rotulo = (texto: string, cor: string = C.link) =>
  `<span style="${fonte(DADO, 12, 500, 1.4)};letter-spacing:.08em;text-transform:uppercase;color:${cor}">${texto}</span>`;

// Vários rótulos numa linha, separados por "·"; no celular a quebra cai entre eles.
const rotulos = (...partes: string[]) =>
  partes.map((t, i) => `<span style="white-space:nowrap">${rotulo(i ? `· ${t}` : t, i ? C.texto2 : C.link)}</span>`).join(" ");

// Chip do painel: pílula com ponto à esquerda, sempre com texto.
const chip = (texto: string, corPonto: string, fundo: string = C.superficie2, corTexto: string = C.texto2) =>
  `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${fundo};${fonte(DADO, 12, 500, 1.4)};color:${corTexto};white-space:nowrap">${ponto(corPonto)}&nbsp;&nbsp;${texto}</span>`;

// Prazo perto (até 2 dias) em alerta, vencido em erro, como no painel.
function corDoPrazo(prazo: string) {
  const dias = diasAtePrazo(prazo);
  return dias < 0 ? [C.erro, C.erroFundo] : dias <= 2 ? [C.alerta, C.alertaFundo] : [C.texto2, C.superficie2];
}

function chipPrazo(prazo: string) {
  const [cor, fundo] = corDoPrazo(prazo);
  return chip(textoPrazo(prazo), cor, fundo, cor);
}

const avatar = (p: Envolvido) =>
  `<span style="display:inline-block;width:20px;height:20px;border-radius:10px;background:${escapar(p.cor)};color:${C.creme};font-family:${TITULO};font-size:9px;font-weight:600;line-height:20px;text-align:center;vertical-align:middle">${escapar(iniciais(p.nome))}</span>`;

const pessoa = (p: Envolvido, comPapel = false) =>
  `<span style="white-space:nowrap">${avatar(p)}&nbsp;<span style="${fonte(TEXTO, 13, 500, 1.4)};color:${C.texto2};vertical-align:middle">${escapar(p.apelido ?? p.nome)}${comPapel ? `, ${nomePapel(p.papel)}` : ""}</span></span>`;

const listaItens = (itens: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${itens
    .map(
      (i) =>
        `<tr><td width="18" valign="top" style="padding-top:10px">${ponto(C.caramelo)}</td><td style="${fonte(TEXTO, 15, 400, 1.5)};color:${C.texto};padding:2px 0">${escapar(i)}</td></tr>`,
    )
    .join("")}</table>`;

const botao = (texto: string, href: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:10px;background:${C.botaoPrimario}"><a href="${escapar(href)}" style="display:inline-block;padding:13px 24px;border-radius:10px;${fonte(TEXTO, 15, 600, 1.2)};color:${C.botaoPrimarioTexto};text-decoration:none">${texto}</a></td></tr></table>`;

// Linha com um rótulo à esquerda e outro à direita (dia e "faltam 3 dias").
const linhaDupla = (esquerda: string, direita: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle">${esquerda}</td><td align="right" valign="middle">${direita}</td></tr></table>`;

function documento(d: { titulo: string; previa: string; miolo: string; nota: string }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapar(d.titulo)}</title>
<style>
  a { color: ${C.link}; }
  @media (max-width: 620px) {
    .moldura { padding: 12px 8px !important; }
    .miolo { padding: 24px 20px !important; }
    .rodape { padding: 20px !important; }
    .titulo { font-size: 21px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.fundo}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapar(d.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.fundo}"><tr><td align="center" class="moldura" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td style="background:${C.espresso};border-radius:16px 16px 0 0"><img src="${escapar(imagemEmail("cabecalho.png"))}" width="600" height="112" alt="MoCCa" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:16px 16px 0 0;color:${C.creme};${fonte(TITULO, 22, 700, 1.2)}"></td></tr>
<tr><td class="miolo" style="background:${C.superficie};border-left:1px solid ${C.linha};border-right:1px solid ${C.linha};padding:32px">
${d.miolo}
</td></tr>
<tr><td class="rodape" style="background:${C.espresso};border-radius:0 0 16px 16px;padding:24px 32px">
<div style="${fonte(TITULO, 14, 600, 1.4)};color:${C.creme}">MoCCa · Monitoramento de Colheita de Café</div>
<div style="${fonte(TEXTO, 13, 400, 1.5)};color:#D8C7B4;margin-top:2px">Projeto da equipe da UFLA no Avança Café.</div>
<div style="${fonte(DADO, 12, 500, 1.4)};letter-spacing:.04em;color:#D49360;margin-top:12px">${COORDENADA_LAVRAS}</div>
<div style="${fonte(TEXTO, 12, 400, 1.5)};color:#B79E8A;margin-top:16px;padding-top:16px;border-top:1px solid #5E3A27">${d.nota}</div>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

const NOTA = "Você recebe este e-mail porque participa de tarefas no painel do MoCCa.";

// ---------------------------------------------------------------------------
// Tarefa atribuída: uma por e-mail, para o que não é da entrega da semana.

export function tarefaAtribuida(d: {
  para: string;
  nome: string;
  titulo: string;
  papel: PapelAtribuicao;
  prazo: string | null;
  itens: string[];
  autor?: string | null;
  link: string;
  semana?: { numero: number; total: number } | null;
  etiquetas?: { nome: string; token: string }[];
  outros?: Envolvido[];
}): Mensagem {
  const abertura = d.autor ? `${d.autor} atribuiu uma tarefa a você no painel do MoCCa.` : "Você recebeu uma tarefa no painel do MoCCa.";
  const papel = nomePapel(d.papel);
  const prazo = d.prazo ? `${dataCurta(d.prazo)} (${textoPrazo(d.prazo)})` : null;
  const outros = d.outros ?? [];

  const texto = [
    `Olá, ${d.nome}.`,
    "",
    abertura,
    "",
    d.titulo,
    `Papel: ${papel}`,
    ...(prazo ? [`Prazo: ${prazo}`] : []),
    ...(d.itens.length ? ["", "Seus itens:", ...d.itens.map((i) => `- ${i}`)] : []),
    ...(outros.length ? ["", `Junto com você: ${outros.map((o) => `${o.apelido ?? o.nome} (${nomePapel(o.papel)})`).join(", ")}`] : []),
    "",
    `Abrir a tarefa: ${d.link}`,
  ].join("\n");

  const etiquetas = (d.etiquetas ?? [])
    .map((e) => chip(escapar(e.nome), coresEtiquetas[e.token] ?? C.texto2, C.superficie2, C.texto))
    .join("&nbsp; ");

  const miolo = [
    rotulos("Nova tarefa", ...(d.semana ? [`Semana ${d.semana.numero} de ${d.semana.total}`] : [])),
    `<div class="titulo" style="${fonte(TITULO, 24, 700, 1.25)};color:${C.espresso};margin-top:10px">${escapar(d.titulo)}</div>`,
    etiquetas ? `<div style="margin-top:12px;line-height:2">${etiquetas}</div>` : "",
    `<div style="${fonte(TEXTO, 16, 400, 1.6)};color:${C.texto};margin-top:20px">Olá, ${escapar(d.nome)}. ${escapar(abertura)}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.superficie2};border-radius:10px;margin-top:20px"><tr>
      <td width="50%" valign="top" style="padding:14px 18px">${rotulo("Papel", C.texto2)}<div style="${fonte(TEXTO, 15, 600, 1.4)};color:${C.texto};margin-top:4px">${papel}</div></td>
      <td width="50%" valign="top" style="padding:14px 18px">${rotulo("Prazo", C.texto2)}<div style="${fonte(TEXTO, 15, 600, 1.4)};color:${C.texto};margin-top:4px">${
        d.prazo ? `${diaDaSemana(d.prazo)}</div><div style="margin-top:6px">${chipPrazo(d.prazo)}` : "sem prazo"
      }</div></td>
    </tr></table>`,
    d.itens.length ? `<div style="margin-top:24px">${rotulo("Seus itens", C.texto2)}</div><div style="margin-top:6px">${listaItens(d.itens)}</div>` : "",
    outros.length
      ? `<div style="margin-top:20px">${rotulo("Junto com você", C.texto2)}</div><div style="margin-top:8px;line-height:2">${outros.map((o) => pessoa(o, true)).join("&nbsp;&nbsp;&nbsp; ")}</div>`
      : "",
    `<div style="margin-top:28px">${botao("Abrir a tarefa", d.link)}</div>`,
  ].join("\n");

  return {
    para: d.para,
    assunto: `Nova tarefa no MoCCa: ${d.titulo}`,
    texto,
    html: documento({
      titulo: d.titulo,
      previa: [abertura, prazo ? `Prazo: ${prazo}.` : ""].join(" ").trim(),
      miolo,
      nota: `${NOTA} As tarefas da entrega da semana chegam juntas, num e-mail só.`,
    }),
  };
}

// ---------------------------------------------------------------------------
// Entrega da semana: um e-mail por pessoa com todas as tarefas ligadas à
// entrega em que ela está, em ordem de prazo, só com os itens dela em cada uma.
// Sem contagem nem progresso: o trabalho é da equipe, o e-mail só diz onde a
// pessoa entra.

export type TarefaDaEntrega = {
  titulo: string;
  papel: PapelAtribuicao;
  prazo: string | null;
  itens: string[];
  outros: Envolvido[];
  link: string;
};

export function entregaDaSemana(d: {
  para: string;
  nome: string;
  semana: {
    numero: number;
    total: number;
    entrega_titulo: string | null;
    entrega_prazo: string | null;
    entrega_url: string | null;
  };
  tarefas: TarefaDaEntrega[];
  linkPainel: string;
}): Mensagem {
  const s = d.semana;
  const titulo = s.entrega_titulo ?? `Entrega da semana ${s.numero}`;
  const ordenadas = [...d.tarefas].sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));

  // Agrupa por dia do prazo em Brasília; sem prazo fica no fim.
  const dias: { chave: string; prazo: string | null; tarefas: TarefaDaEntrega[] }[] = [];
  for (const t of ordenadas) {
    const chave = t.prazo ? paraCampoData(t.prazo) : "sem-prazo";
    const ultimo = dias[dias.length - 1];
    if (ultimo?.chave === chave) ultimo.tarefas.push(t);
    else dias.push({ chave, prazo: t.prazo, tarefas: [t] });
  }

  const comQuem = (t: TarefaDaEntrega) => t.outros.map((o) => o.apelido ?? o.nome).join(", ");

  const texto = [
    `Olá, ${d.nome}.`,
    "",
    `${titulo} (semana ${s.numero} de ${s.total})`,
    ...(s.entrega_prazo ? [`Prazo: ${diaDaSemana(s.entrega_prazo, true)} (${textoPrazo(s.entrega_prazo)})`] : []),
    ...(s.entrega_url ? [`Documento: ${s.entrega_url}`] : []),
    "",
    "A entrega desta semana é feita a várias mãos. Estas são as tarefas dela em que você entra, com o que fica com você em cada uma:",
    ...dias.flatMap((g) => [
      "",
      (g.prazo ? diaDaSemana(g.prazo) : "sem prazo").toUpperCase(),
      ...g.tarefas.flatMap((t) => [
        "",
        t.titulo,
        `Você: ${nomePapel(t.papel)}${t.outros.length ? ` · com ${comQuem(t)}` : ""}`,
        ...t.itens.map((i) => `- ${i}`),
        `Abrir: ${t.link}`,
      ]),
    ]),
    "",
    `Ver minhas tarefas: ${d.linkPainel}`,
  ].join("\n");

  const destaque = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.superficie2};border-radius:10px"><tr><td style="padding:20px 22px">
    ${rotulos("Avança Café", `Semana ${s.numero} de ${s.total}`)}
    <div class="titulo" style="${fonte(TITULO, 24, 700, 1.25)};color:${C.espresso};margin-top:10px">${escapar(titulo)}</div>
    ${
      s.entrega_prazo
        ? `<div style="margin-top:12px"><span style="${fonte(DADO, 14, 400, 1.6)};color:${C.texto};vertical-align:middle">Prazo: ${diaDaSemana(s.entrega_prazo, true)}</span>&nbsp;&nbsp; ${chipPrazo(s.entrega_prazo)}</div>`
        : ""
    }
    ${s.entrega_url ? `<div style="margin-top:12px"><a href="${escapar(s.entrega_url)}" style="${fonte(TEXTO, 14, 600, 1.4)};color:${C.link}">Abrir o documento da entrega →</a></div>` : ""}
  </td></tr></table>`;

  const cartao = (t: TarefaDaEntrega) => `<tr><td style="padding-top:10px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.linha};border-radius:10px;background:${C.superficie}"><tr><td style="padding:16px 18px">
      <a href="${escapar(t.link)}" style="${fonte(TITULO, 16, 600, 1.35)};color:${C.texto};text-decoration:none">${escapar(t.titulo)}</a>
      <div style="margin-top:10px;line-height:2">${chip(nomePapel(t.papel), t.papel === "responsavel" ? C.caramelo : "#B79E8A")}${
        t.outros.length
          ? `&nbsp;&nbsp; <span style="${fonte(TEXTO, 13, 400, 1.4)};color:${C.texto2};vertical-align:middle">com</span>&nbsp; ${t.outros.map((o) => pessoa(o)).join("&nbsp;&nbsp; ")}`
          : ""
      }</div>
      ${t.itens.length ? `<div style="margin-top:10px">${listaItens(t.itens)}</div>` : ""}
      <div style="margin-top:12px"><a href="${escapar(t.link)}" style="${fonte(TEXTO, 14, 600, 1.4)};color:${C.link}">Abrir no painel →</a></div>
    </td></tr></table>
  </td></tr>`;

  const grupos = dias
    .map(
      (g) => `<tr><td style="padding-top:28px">${linhaDupla(
        `${ponto(C.caramelo, 8)}&nbsp;&nbsp;${rotulo(g.prazo ? diaDaSemana(g.prazo) : "Sem prazo", C.espresso)}`,
        g.prazo ? `<span style="${fonte(DADO, 12, 400, 1.4)};color:${corDoPrazo(g.prazo)[0]}">${textoPrazo(g.prazo)}</span>` : "",
      )}</td></tr>
      ${g.tarefas.map(cartao).join("")}`,
    )
    .join("");

  const miolo = [
    destaque,
    `<div style="${fonte(TEXTO, 16, 400, 1.6)};color:${C.texto};margin-top:28px">Olá, ${escapar(d.nome)}. A entrega desta semana é feita a várias mãos. Abaixo estão as tarefas dela em que você entra, com o que fica com você em cada uma, na ordem dos prazos.</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${grupos}</table>`,
    `<div style="margin-top:32px">${botao("Ver minhas tarefas", d.linkPainel)}</div>`,
  ].join("\n");

  const primeiro = ordenadas.find((t) => t.prazo)?.prazo;
  return {
    para: d.para,
    assunto: `${titulo}: onde você entra`,
    texto,
    html: documento({
      titulo,
      previa: `O que fica com você em cada tarefa da entrega${primeiro ? `, a começar por ${diaDaSemana(primeiro)}` : ""}.`,
      miolo,
      nota: `${NOTA} As outras tarefas, fora da entrega, continuam chegando uma a uma.`,
    }),
  };
}

export type SemanaPacote = {
  id: string;
  numero: number;
  total: number;
  entrega_titulo: string | null;
  entrega_prazo: string | null;
  entrega_url: string | null;
};

export type LinhaPacote = {
  pessoa_id: string;
  para: string;
  nome: string;
  tarefa_id: string;
  titulo: string;
  prazo: string | null;
  papel: PapelAtribuicao;
  itens: string[];
  outros: Envolvido[];
};

// Um pacote por pessoa, com as tarefas dela (linhas de SQL_PACOTE).
export function pacotesDaSemana(
  semana: SemanaPacote,
  linhas: LinhaPacote[],
  links: { tarefa: (id: string) => string; painel: string },
): Mensagem[] {
  const porPessoa = new Map<string, LinhaPacote[]>();
  for (const l of linhas) porPessoa.set(l.pessoa_id, [...(porPessoa.get(l.pessoa_id) ?? []), l]);
  return [...porPessoa.values()].map((ls) => ({
    ...entregaDaSemana({
      para: ls[0].para,
      nome: ls[0].nome,
      semana,
      tarefas: ls.map((l) => ({ titulo: l.titulo, papel: l.papel, prazo: l.prazo, itens: l.itens, outros: l.outros, link: links.tarefa(l.tarefa_id) })),
      linkPainel: links.painel,
    }),
    registro: { tipo: "entrega", pessoa_id: ls[0].pessoa_id, semana_id: semana.id, tarefas: ls.map((l) => l.tarefa_id) },
  }));
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

// Lembrete da véspera (fase 4): as tarefas abertas que vencem no dia $1
// (YYYY-MM-DD, em Brasília), uma linha por pessoa ativa atribuída, com os
// itens dela que ainda não foram feitos. Tarefa arquivada ou feita não entra.
export const SQL_LEMBRETES = `
  select p.email as para, coalesce(p.apelido, p.nome) as nome, a.papel::text as papel,
         t.id as tarefa_id, t.titulo, t.prazo,
         coalesce((select json_agg(i.texto order by i.posicao, i.id) from item i
                    where i.atribuicao_id = a.id and not i.feito), '[]'::json) as itens
    from tarefa t
    join atribuicao a on a.tarefa_id = t.id
    join pessoa p on p.id = a.pessoa_id
   where not t.arquivada and t.status <> 'feito' and p.ativo
     and (t.prazo at time zone 'America/Sao_Paulo')::date = $1::date
   order by p.email, t.prazo, t.titulo`;

export type LinhaLembrete = {
  para: string;
  nome: string;
  papel: PapelAtribuicao;
  tarefa_id: string;
  titulo: string;
  prazo: string;
  itens: string[];
};

// Um e-mail por pessoa, com todas as tarefas dela que vencem amanhã.
export function lembretesDaVespera(linhas: LinhaLembrete[], link: (tarefaId: string) => string): Mensagem[] {
  const porPessoa = new Map<string, LinhaLembrete[]>();
  for (const l of linhas) porPessoa.set(l.para, [...(porPessoa.get(l.para) ?? []), l]);
  return [...porPessoa.values()].map((tarefas) => {
    const { para, nome } = tarefas[0];
    const assunto =
      tarefas.length === 1 ? `Amanhã vence: ${tarefas[0].titulo}` : `Amanhã vencem ${tarefas.length} tarefas suas no MoCCa`;
    const abertura =
      tarefas.length === 1 ? "Uma tarefa sua no painel do MoCCa vence amanhã." : `${tarefas.length} tarefas suas no painel do MoCCa vencem amanhã.`;
    const blocoTexto = (t: LinhaLembrete) =>
      [
        t.titulo,
        `Prazo: ${dataCurta(t.prazo)}${t.papel === "apoio" ? " · você está de apoio" : ""}`,
        ...(t.itens.length ? ["Seus itens abertos:", ...t.itens.map((i) => `- ${i}`)] : []),
        `Abrir: ${link(t.tarefa_id)}`,
      ].join("\n");
    const blocoHtml = (t: LinhaLembrete) =>
      [
        `<p><strong>${escapar(t.titulo)}</strong><br>Prazo: ${escapar(dataCurta(t.prazo))}${t.papel === "apoio" ? " · você está de apoio" : ""}</p>`,
        t.itens.length ? `<p>Seus itens abertos:</p><ul>${t.itens.map((i) => `<li>${escapar(i)}</li>`).join("")}</ul>` : "",
        `<p><a href="${escapar(link(t.tarefa_id))}">Abrir a tarefa</a></p>`,
      ].join("");
    const fecho = "Se já terminou, marque como feita no painel e este lembrete para de chegar.";
    return {
      para,
      assunto,
      texto: [`Olá, ${nome}.`, abertura, ...tarefas.map(blocoTexto), fecho].join("\n\n"),
      html: corpoHtml([`<p>Olá, ${escapar(nome)}.</p>`, `<p>${escapar(abertura)}</p>`, ...tarefas.map(blocoHtml), `<p>${escapar(fecho)}</p>`].join("")),
    };
  });
}
