"use client";

import { ArchiveRestore } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { atualizarTarefa } from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { dataCurta } from "@/lib/painel/datas";
import type { TarefaArquivada } from "@/lib/painel/arquivadas";
import { rotuloStatus } from "@/lib/painel/tipos";
import { usePainel } from "./contexto";
import { EstadoVazio } from "./elementos";

// Tarefas arquivadas: o caminho de volta do botão Arquivar do card.

export function ListaArquivadas({ tarefas }: { tarefas: TarefaArquivada[] }) {
  if (!tarefas.length) return <EstadoVazio texto="Nada arquivado. Ao arquivar uma tarefa, ela sai do Quadro e fica aqui." />;
  return (
    <ul className="flex flex-col divide-y divide-linha rounded-m border border-linha bg-superficie">
      {tarefas.map((t) => (
        <LinhaArquivada key={t.id} tarefa={t} />
      ))}
    </ul>
  );
}

function LinhaArquivada({ tarefa: t }: { tarefa: TarefaArquivada }) {
  const { podeEditar, avisar } = usePainel();
  const [pendente, iniciar] = useTransition();
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <Link href={`/painel/tarefas/${t.id}`} scroll={false} className="block truncate font-medium text-texto hover:underline">
          {t.titulo}
        </Link>
        <p className="t-dado text-[0.8125rem] text-texto-2">
          {[t.semana ? `S${t.semana}` : null, rotuloStatus(t.status).toLowerCase(), `arquivada em ${dataCurta(t.atualizado_em)}`].filter(Boolean).join(" · ")}
        </p>
      </div>
      {podeEditar && (
        <Botao
          variante="fantasma"
          tamanho="painel"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await atualizarTarefa(t.id, { arquivada: false });
              avisar(r.ok ? "Tarefa restaurada." : r.erro, { erro: !r.ok });
            })
          }
        >
          <ArchiveRestore aria-hidden />
          Restaurar
        </Botao>
      )}
    </li>
  );
}
