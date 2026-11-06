// Regras do Quadro (seção 9.3, DUVIDAS 4q), sem React nem banco: agrupar por
// coluna, o que a coluna Feito mostra, e onde o cartão fica depois de solto.
// A tela e o servidor falam em vizinhos (o cartão de cima e o de baixo), não em
// números de posição: quem calcula a posição é o servidor (lib/painel/mover.ts).

import type { Status, TarefaResumo } from "./tipos";

export type Colunas = Record<Status, TarefaResumo[]>;
export type Movimento = { id: string; status: Status; antes: string | null; depois: string | null };

export const LIMITE_FEITO = 20;

const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// A mesma ordem do servidor: posição, criação e id (dados.ts).
export function agrupar(tarefas: TarefaResumo[]): Colunas {
  const c: Colunas = { a_fazer: [], fazendo: [], em_revisao: [], feito: [] };
  for (const t of tarefas) c[t.status].push(t);
  for (const s of Object.keys(c) as Status[])
    c[s].sort((a, b) => a.posicao - b.posicao || comparar(a.criado_em, b.criado_em) || comparar(a.id, b.id));
  return c;
}

// Feito mostra só as 20 concluídas mais recentes, na ordem da coluna. A que
// acabou de chegar (ainda sem data de conclusão) conta como a mais recente,
// para não sumir no meio do arrasto.
export function visiveis(status: Status, lista: TarefaResumo[], todasFeitas: boolean) {
  if (status !== "feito" || todasFeitas || lista.length <= LIMITE_FEITO) return lista;
  const recentes = new Set(
    [...lista]
      .sort((a, b) => (b.concluido_em ?? "￿").localeCompare(a.concluido_em ?? "￿"))
      .slice(0, LIMITE_FEITO)
      .map((t) => t.id),
  );
  return lista.filter((t) => recentes.has(t.id));
}

export function vizinhos(lista: TarefaResumo[], id: string) {
  const i = lista.findIndex((t) => t.id === id);
  return { antes: lista[i - 1]?.id ?? null, depois: lista[i + 1]?.id ?? null };
}

// Põe a tarefa na coluna do movimento, logo depois de `antes` (ou logo antes de
// `depois`, ou no fim). É a cópia otimista do que o servidor vai gravar.
export function moverNasColunas(c: Colunas, m: Movimento): Colunas {
  let tarefa: TarefaResumo | undefined;
  const nova = {} as Colunas;
  for (const s of Object.keys(c) as Status[]) {
    nova[s] = c[s].filter((t) => {
      if (t.id !== m.id) return true;
      tarefa = t;
      return false;
    });
  }
  if (!tarefa) return c;
  if (tarefa.status !== m.status)
    tarefa = { ...tarefa, status: m.status, concluido_em: m.status === "feito" ? new Date().toISOString() : null };
  const destino = nova[m.status];
  const iAntes = m.antes ? destino.findIndex((t) => t.id === m.antes) : -1;
  const iDepois = m.depois ? destino.findIndex((t) => t.id === m.depois) : -1;
  const i = iAntes >= 0 ? iAntes + 1 : iDepois >= 0 ? iDepois : m.antes || !m.depois ? destino.length : 0;
  destino.splice(i, 0, tarefa);
  return nova;
}

// Posição entre os vizinhos, ou null quando não há número entre eles (empate,
// ordem invertida ou o vão ficou pequeno demais): aí o servidor renumera a coluna.
export function posicaoEntre(antes: number | null, depois: number | null): number | null {
  if (antes !== null && depois !== null) {
    const meio = antes / 2 + depois / 2;
    return antes < meio && meio < depois ? meio : null;
  }
  if (antes !== null) return antes + 1 > antes ? antes + 1 : null;
  if (depois !== null) return depois - 1 < depois ? depois - 1 : null;
  return null;
}
