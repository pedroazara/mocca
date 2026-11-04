import { dataHoraComAno } from "./datas";
import {
  rotuloStatus,
  TIPOS_DOCUMENTO,
  type PapelAtribuicao,
  type Proposta,
  type Status,
  type TarefaAtual,
  type TipoDocumento,
} from "./tipos";
import type { Pedido } from "@/lib/api/servico";

// Regras puras da tela de Aprovações (seção 9.10): o nome de cada proposta do
// Claude, os avisos, a comparação de uma alteração com a tarefa de hoje e a
// limpeza do que o admin editou. O cartão de cada proposta mostra tudo o que
// ela grava, porque o admin decide olhando para ele.

export type DadosDe<O extends Pedido["operacao"]> = Extract<Pedido, { operacao: O }>["dados"];
export type ResumoProposta = { titulo: string; acao: string; aviso?: string };

export const textoOuVazio = (v: string | null | undefined) => v || "vazio";
// com o ano: uma data pode mudar só nele, e o admin precisa ver
export const textoPrazoProposto = (v: string | null | undefined) => (v ? dataHoraComAno(v) : "sem prazo");
export const textoSemana = (v: number | null | undefined) => (v ? `Semana ${v}` : "sem semana");
export const textoEtiquetas = (v: string[] | null | undefined) => (v?.length ? v.join(", ") : "nenhuma");
export const textoSimNao = (v: boolean | null | undefined) => (v ? "sim" : "não");
export const textoPapel = (v: string | null | undefined) =>
  v === "apoio" ? "apoio" : v === "responsavel" ? "responsável" : "papel automático";
export const textoTipoDocumento = (v: TipoDocumento | null | undefined) =>
  TIPOS_DOCUMENTO.find((t) => t.valor === (v ?? "outro"))?.rotulo ?? "outro";

const AVISO_ETIQUETAS = "As etiquetas propostas substituem a lista inteira: a tarefa fica só com elas.";
const AVISO_SEMANA = "Se o prazo cai dentro da semana em que a tarefa está hoje, ele vai junto para a semana nova.";

export function resumirProposta(p: Proposta, nome: (id: string) => string): ResumoProposta {
  const tarefa = p.tarefa_titulo ? `“${p.tarefa_titulo}”` : "uma tarefa que não existe mais";
  // o estado de hoje só vale enquanto a proposta espera; depois, já não é o que o admin comparou
  const pendente = p.status === "pendente";

  switch (p.operacao) {
    case "criar_tarefa":
      return { titulo: `Criar a tarefa “${p.dados.titulo}”`, acao: "Tarefa nova" };

    case "atualizar_tarefa": {
      const c = p.dados.campos;
      const avisos = [
        ...(c.etiquetas ? [AVISO_ETIQUETAS] : []),
        ...(typeof c.semana === "number" && c.prazo === undefined ? [AVISO_SEMANA] : []),
      ];
      return { titulo: `Alterar ${tarefa}`, acao: "Alteração", ...(avisos.length ? { aviso: avisos.join(" ") } : {}) };
    }

    case "atribuir": {
      const d = p.dados;
      const agora = pendente ? p.papel_atual : null;
      if (!agora) return { titulo: `Atribuir ${nome(d.pessoa)} a ${tarefa}`, acao: "Atribuição" };
      const novo = d.papel ?? agora;
      return novo === agora
        ? { titulo: `Adicionar itens de ${nome(d.pessoa)} em ${tarefa}`, acao: "Itens novos" }
        : {
            titulo: `Mudar o papel de ${nome(d.pessoa)} em ${tarefa}`,
            acao: "Troca de papel",
            ...(agora === "responsavel" ? { aviso: "Se essa pessoa for a única responsável, a tarefa fica sem responsável." } : {}),
          };
    }

    case "remover_atribuicao": {
      const lista = pendente ? (p.itens_da_pessoa ?? []) : [];
      return {
        titulo: `Tirar ${nome(p.dados.pessoa)} de ${tarefa}`,
        acao: "Saída da tarefa",
        ...(lista.length ? { aviso: "Os itens dessa pessoa nesta tarefa são apagados junto e não voltam." } : {}),
      };
    }

    case "adicionar_item":
      return {
        titulo: `Adicionar item de ${nome(p.dados.pessoa)} em ${tarefa}`,
        acao: "Item novo",
        ...(pendente && p.tarefa_titulo && !p.papel_atual
          ? { aviso: "Essa pessoa ainda não está na tarefa: ao aprovar, entra nela e recebe o e-mail de tarefa atribuída. Fica como responsável, se a tarefa não tiver um, ou como apoio." }
          : {}),
      };

    case "atualizar_item": {
      const d = p.dados;
      const [verbo, acao] = d.texto !== undefined ? ["Alterar", "Item alterado"] : d.feito ? ["Marcar", "Item marcado"] : ["Desmarcar", "Item desmarcado"];
      return { titulo: `${verbo} item de ${tarefa}`, acao };
    }

    case "adicionar_documento":
      return { titulo: `Ligar documento a ${tarefa}`, acao: "Documento" };

    case "comentar":
      return { titulo: `Comentar em ${tarefa}`, acao: "Comentário" };
  }
}

// ------------------------------------------------------------------ alteração

type Campos = DadosDe<"atualizar_tarefa">["campos"];
export type CampoTarefa = keyof Campos & keyof TarefaAtual;

export const CAMPOS_TAREFA: { campo: CampoTarefa; rotulo: string }[] = [
  { campo: "titulo", rotulo: "Título" },
  { campo: "descricao", rotulo: "Descrição" },
  { campo: "status", rotulo: "Status" },
  { campo: "prazo", rotulo: "Prazo" },
  { campo: "semana", rotulo: "Semana" },
  { campo: "etiquetas", rotulo: "Etiquetas" },
  { campo: "ligada_entrega", rotulo: "Ligada à entrega" },
];

const formatar: { [C in CampoTarefa]: (v: Campos[C] | TarefaAtual[C]) => string } = {
  titulo: (v) => textoOuVazio(v),
  descricao: (v) => textoOuVazio(v),
  status: (v) => rotuloStatus(v as Status),
  prazo: textoPrazoProposto,
  semana: textoSemana,
  etiquetas: textoEtiquetas,
  ligada_entrega: textoSimNao,
};

export type Mudanca = { campo: CampoTarefa; rotulo: string; proposto: string; atual?: string };

// Só os campos que a alteração manda, na ordem da tela. Enquanto a proposta
// espera, cada um vem com o valor de hoje, para o admin comparar.
export function mudancasDaTarefa(p: Pick<Proposta, "status" | "atual"> & { dados: DadosDe<"atualizar_tarefa"> }): Mudanca[] {
  const c = p.dados.campos;
  const a = p.status === "pendente" ? p.atual : null;
  return CAMPOS_TAREFA.filter(({ campo }) => c[campo] !== undefined).map(({ campo, rotulo }) => {
    const f = formatar[campo] as (v: unknown) => string;
    return { campo, rotulo, proposto: f(c[campo]), ...(a ? { atual: f(a[campo]) } : {}) };
  });
}

// ------------------------------------------------------------------ edição

const URL_DRIVE = /^https:\/\/(drive|docs)\.google\.com\//;
const limpar = (v: string | null | undefined) => (v ?? "").trim();
const itensLimpos = (v: string[] | undefined) => (v ?? []).map((i) => i.trim()).filter(Boolean);

type Preparo = { ok: true; dados: Pedido["dados"] } | { ok: false; erro: string };

function documentoComErro(d: { titulo: string; url: string }) {
  if (!limpar(d.titulo)) return "Dê um título ao documento.";
  if (!URL_DRIVE.test(limpar(d.url))) return "Use um link do Google Drive ou do Google Docs no documento.";
  return null;
}

// Antes de mandar o que o admin editou: tira espaços e itens em branco e diz o
// que falta, com as mesmas regras que o servidor confere de novo.
export function prepararEdicao(pedido: Pedido): Preparo {
  switch (pedido.operacao) {
    case "criar_tarefa": {
      const d = pedido.dados;
      if (!limpar(d.titulo)) return { ok: false, erro: "Dê um título para a tarefa." };
      const documentos = (d.documentos ?? []).map((x) => ({ ...x, titulo: limpar(x.titulo), url: limpar(x.url) }));
      const ruim = documentos.map(documentoComErro).find(Boolean);
      if (ruim) return { ok: false, erro: ruim };
      return {
        ok: true,
        dados: {
          ...d,
          titulo: limpar(d.titulo),
          descricao: limpar(d.descricao) || null,
          atribuicoes: (d.atribuicoes ?? []).map((a) => ({ ...a, itens: itensLimpos(a.itens) })),
          documentos,
        },
      };
    }

    case "atualizar_tarefa": {
      const c = { ...pedido.dados.campos };
      if (!Object.values(c).some((v) => v !== undefined))
        return { ok: false, erro: "Escolha ao menos um campo para mudar, ou recuse a proposta." };
      if (c.titulo !== undefined) {
        c.titulo = limpar(c.titulo);
        if (!c.titulo) return { ok: false, erro: "Dê um título para a tarefa." };
      }
      if (c.descricao !== undefined) c.descricao = limpar(c.descricao) || null;
      return { ok: true, dados: { ...pedido.dados, campos: c } };
    }

    case "atribuir":
      return { ok: true, dados: { ...pedido.dados, itens: itensLimpos(pedido.dados.itens) } };

    case "remover_atribuicao":
      return { ok: false, erro: "Esta proposta não tem o que editar: aprove ou recuse." };

    case "adicionar_item": {
      const texto = limpar(pedido.dados.texto);
      return texto ? { ok: true, dados: { ...pedido.dados, texto } } : { ok: false, erro: "Escreva o item." };
    }

    case "atualizar_item": {
      const d = pedido.dados;
      const texto = d.texto === undefined ? undefined : limpar(d.texto);
      if (texto === "") return { ok: false, erro: "Escreva o item." };
      if (texto === undefined && d.feito === undefined) return { ok: false, erro: "Escolha o que muda no item." };
      return { ok: true, dados: { ...d, texto } };
    }

    case "adicionar_documento": {
      const d = { ...pedido.dados, titulo: limpar(pedido.dados.titulo), url: limpar(pedido.dados.url) };
      const ruim = documentoComErro(d);
      return ruim ? { ok: false, erro: ruim } : { ok: true, dados: d };
    }

    case "comentar": {
      const texto = limpar(pedido.dados.texto);
      return texto ? { ok: true, dados: { ...pedido.dados, texto } } : { ok: false, erro: "Escreva o comentário." };
    }
  }
}

// Papel de quem entra: sem papel, o servidor escolhe (responsável, se a tarefa
// não tiver um; senão, apoio). Na edição, a lista de papéis usa estes valores.
export const PAPEIS: { valor: PapelAtribuicao | ""; rotulo: string }[] = [
  { valor: "", rotulo: "automático" },
  { valor: "responsavel", rotulo: "responsável" },
  { valor: "apoio", rotulo: "apoio" },
];
