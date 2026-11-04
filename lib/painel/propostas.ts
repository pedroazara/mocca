import { dataHoraComAno } from "./datas";
import { rotuloStatus, TIPOS_DOCUMENTO, type Proposta, type Status, type TipoDocumento } from "./tipos";

// Texto de cada proposta do Claude na tela de Aprovações (seção 11.4). O admin
// decide por este resumo, então tudo o que a proposta grava precisa aparecer aqui.

export type LinhaProposta = { rotulo: string; proposto: string; atual?: string };
export type ResumoProposta = { titulo: string; linhas: LinhaProposta[]; aviso?: string };

const texto = (v: string | null | undefined) => v || "vazio";
// com o ano: uma data pode mudar só nele, e o admin precisa ver
const prazo = (v: string | null | undefined) => (v ? dataHoraComAno(v) : "sem prazo");
const semana = (v: number | null | undefined) => (v ? `Semana ${v}` : "sem semana");
const etiquetas = (v: string[] | null | undefined) => (v?.length ? v.join(", ") : "nenhuma");
const simNao = (v: boolean | null | undefined) => (v ? "sim" : "não");
const papel = (v: string | null | undefined) => (v === "apoio" ? "apoio" : v === "responsavel" ? "responsável" : "papel automático");
const itens = (v: string[] | null | undefined) => (v?.length ? v.join("; ") : "sem itens");
const tipoDocumento = (v: TipoDocumento | null | undefined) => TIPOS_DOCUMENTO.find((t) => t.valor === (v ?? "outro"))?.rotulo;

export function resumirProposta(p: Proposta, nome: (id: string) => string): ResumoProposta {
  const tarefa = p.tarefa_titulo ? `“${p.tarefa_titulo}”` : "uma tarefa que não existe mais";
  // o estado de hoje só vale enquanto a proposta espera; depois, já não é o que o admin comparou
  const pendente = p.status === "pendente";

  switch (p.operacao) {
    case "criar_tarefa": {
      const d = p.dados;
      const linhas: LinhaProposta[] = [];
      if (d.descricao) linhas.push({ rotulo: "Descrição", proposto: d.descricao });
      if (d.semana) linhas.push({ rotulo: "Semana", proposto: semana(d.semana) });
      linhas.push({ rotulo: "Prazo", proposto: d.prazo ? prazo(d.prazo) : d.semana ? "fim da semana" : "sem prazo" });
      if (d.status && d.status !== "a_fazer") linhas.push({ rotulo: "Status", proposto: rotuloStatus(d.status) });
      if (d.etiquetas?.length) linhas.push({ rotulo: "Etiquetas", proposto: etiquetas(d.etiquetas) });
      if (d.ligada_entrega) linhas.push({ rotulo: "Ligada à entrega", proposto: "sim" });
      if (d.origem === "reuniao") linhas.push({ rotulo: "Origem", proposto: "reunião" });
      for (const a of d.atribuicoes ?? []) linhas.push({ rotulo: `${nome(a.pessoa)} (${papel(a.papel)})`, proposto: itens(a.itens) });
      for (const doc of d.documentos ?? []) linhas.push({ rotulo: "Documento", proposto: `${doc.titulo} (${tipoDocumento(doc.tipo)}): ${doc.url}` });
      return { titulo: `Criar a tarefa “${d.titulo}”`, linhas };
    }

    case "atualizar_tarefa": {
      const c = p.dados.campos;
      const a = pendente ? p.atual : null;
      const linhas: LinhaProposta[] = [];
      const campo = <T,>(rotulo: string, novo: T | undefined, atual: T | undefined, formatar: (v: T) => string) => {
        if (novo !== undefined) linhas.push({ rotulo, proposto: formatar(novo), ...(a ? { atual: formatar(atual as T) } : {}) });
      };
      campo("Título", c.titulo, a?.titulo, texto);
      campo("Descrição", c.descricao, a?.descricao, texto);
      campo<Status>("Status", c.status, a?.status, rotuloStatus);
      campo("Prazo", c.prazo, a?.prazo, prazo);
      campo("Semana", c.semana, a?.semana, semana);
      campo("Etiquetas", c.etiquetas, a?.etiquetas, etiquetas);
      campo("Ligada à entrega", c.ligada_entrega, a?.ligada_entrega, simNao);
      const avisos = [
        ...(c.etiquetas ? ["As etiquetas propostas substituem a lista inteira: a tarefa fica só com elas."] : []),
        ...(typeof c.semana === "number" && c.prazo === undefined
          ? ["Se o prazo cai dentro da semana em que a tarefa está hoje, ele vai junto para a semana nova."]
          : []),
      ];
      return { titulo: `Alterar ${tarefa}`, linhas, ...(avisos.length ? { aviso: avisos.join(" ") } : {}) };
    }

    case "atribuir": {
      const d = p.dados;
      const agora = pendente ? p.papel_atual : null;
      if (!agora)
        return {
          titulo: `Atribuir ${nome(d.pessoa)} a ${tarefa}`,
          linhas: [
            { rotulo: "Papel", proposto: papel(d.papel) },
            { rotulo: "Itens", proposto: itens(d.itens) },
          ],
        };
      const novo = d.papel ?? agora;
      return {
        titulo: novo === agora ? `Adicionar itens de ${nome(d.pessoa)} em ${tarefa}` : `Mudar o papel de ${nome(d.pessoa)} em ${tarefa}`,
        linhas: [
          { rotulo: "Papel", atual: papel(agora), proposto: papel(novo) },
          { rotulo: "Itens novos", proposto: itens(d.itens) },
        ],
        ...(agora === "responsavel" && novo === "apoio" ? { aviso: "Se essa pessoa for a única responsável, a tarefa fica sem responsável." } : {}),
      };
    }

    case "remover_atribuicao": {
      const lista = pendente ? (p.itens_da_pessoa ?? []) : [];
      return {
        titulo: `Tirar ${nome(p.dados.pessoa)} de ${tarefa}`,
        linhas: lista.length ? [{ rotulo: "Itens apagados", proposto: lista.map((i) => (i.feito ? `${i.texto} (feito)` : i.texto)).join("; ") }] : [],
        ...(lista.length ? { aviso: "Os itens dessa pessoa nesta tarefa são apagados junto e não voltam." } : {}),
      };
    }

    case "adicionar_item":
      return {
        titulo: `Adicionar item de ${nome(p.dados.pessoa)} em ${tarefa}`,
        linhas: [{ rotulo: "Item", proposto: p.dados.texto }],
        ...(pendente && p.tarefa_titulo && !p.papel_atual
          ? { aviso: "Essa pessoa ainda não está na tarefa: ao aprovar, entra nela e recebe o e-mail de tarefa atribuída. Fica como responsável, se a tarefa não tiver um, ou como apoio." }
          : {}),
      };

    case "atualizar_item": {
      const d = p.dados;
      const acao = d.texto !== undefined ? "Alterar" : d.feito ? "Marcar" : "Desmarcar";
      const linhas: LinhaProposta[] = [];
      linhas.push({ rotulo: "Item", proposto: p.item_texto ?? "um item que não existe mais" });
      if (d.texto !== undefined) linhas.push({ rotulo: "Novo texto", proposto: d.texto });
      if (d.texto !== undefined && d.feito !== undefined) linhas.push({ rotulo: "Feito", proposto: simNao(d.feito) });
      return { titulo: `${acao} item de ${tarefa}`, linhas };
    }

    case "adicionar_documento":
      return {
        titulo: `Ligar documento a ${tarefa}`,
        linhas: [
          { rotulo: "Título", proposto: p.dados.titulo },
          { rotulo: "Tipo", proposto: String(tipoDocumento(p.dados.tipo)) },
          { rotulo: "Link", proposto: p.dados.url },
        ],
      };

    case "comentar":
      return { titulo: `Comentar em ${tarefa}`, linhas: [{ rotulo: "Comentário", proposto: p.dados.texto }] };
  }
}
