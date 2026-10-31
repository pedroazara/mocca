import type { Metadata } from "next";
import { DetalheTarefa, TarefaNaoEncontrada } from "@/components/painel/detalhe-tarefa";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { tarefa } from "@/lib/painel/dados";

export const metadata: Metadata = { title: "Tarefa" };

export default async function PaginaTarefa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eu = await exigirPessoa(`/painel/tarefas/${id}`);
  const t = /^[0-9a-f-]{36}$/i.test(id) ? await comoUsuario(eu.authId, (q) => tarefa(q, id)) : null;

  return (
    <>
      <TopoPagina titulo={t ? `Semana ${t.semana ?? "–"}` : "Tarefa"} migalhas={[{ href: "/painel/quadro", rotulo: "Quadro" }]} />
      <ConteudoPagina>
        <div className="mx-auto max-w-[1040px]">{t ? <DetalheTarefa tarefa={t} /> : <TarefaNaoEncontrada />}</div>
      </ConteudoPagina>
    </>
  );
}
