import { estaAtrasada, semanaDoDia, hojeBrasilia } from "./datas";
import type { Contato, Semana, TarefaResumo } from "./tipos";

// Pauta gerada da reunião (seção 9.6), em 4 blocos:
// 1. entrega do programa da semana e status; 2. tarefas atrasadas;
// 3. tarefas concluídas desde a última reunião; 4. contatos novos.

export type Pauta = {
  semana: Semana | null;
  entrega: TarefaResumo[];
  atrasadas: TarefaResumo[];
  concluidas: TarefaResumo[];
  contatosNovos: Contato[];
};

export function montarPauta({
  semanas,
  tarefas,
  contatos,
  dataReuniao,
  reuniaoAnterior,
  agora = new Date(),
}: {
  semanas: Semana[];
  tarefas: TarefaResumo[];
  contatos: Contato[];
  dataReuniao: string;
  reuniaoAnterior: string | null;
  agora?: Date;
}): Pauta {
  const semana = semanaDoDia(semanas, hojeBrasilia(new Date(dataReuniao))) ?? null;
  const desde = reuniaoAnterior ? new Date(reuniaoAnterior).getTime() : -Infinity;
  const ate = new Date(dataReuniao).getTime();
  return {
    semana,
    entrega: semana ? tarefas.filter((t) => t.ligada_entrega && t.semana === semana.numero) : [],
    atrasadas: tarefas.filter((t) => estaAtrasada(t, agora)),
    concluidas: tarefas.filter((t) => {
      if (t.status !== "feito" || !t.concluido_em) return false;
      const c = new Date(t.concluido_em).getTime();
      return c > desde && c <= Math.max(ate, agora.getTime());
    }),
    contatosNovos: contatos.filter((c) => c.status === "novo"),
  };
}

// Reunião imediatamente anterior a uma data, numa lista de reuniões.
export function reuniaoAnteriorA(reunioes: { data: string }[], data: string) {
  const alvo = new Date(data).getTime();
  const antes = reunioes.map((r) => new Date(r.data).getTime()).filter((d) => d < alvo);
  return antes.length ? new Date(Math.max(...antes)).toISOString() : null;
}
