import "server-only";
import type { Consulta } from "@/lib/banco";
import type { Status } from "./tipos";

// Tarefas arquivadas: saem do Quadro e das listas, mas continuam no banco e podem
// ser restauradas. A última mudança da tarefa arquivada costuma ser o próprio arquivar.

export type TarefaArquivada = {
  id: string;
  titulo: string;
  status: Status;
  semana: number | null;
  atualizado_em: string;
};

export function tarefasArquivadas(q: Consulta) {
  return q<TarefaArquivada>(
    `select t.id, t.titulo, t.status::text as status, s.numero as semana, t.atualizado_em
       from tarefa t left join semana s on s.id = t.semana_id
      where t.arquivada
      order by t.atualizado_em desc`,
  );
}
