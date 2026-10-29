import type { Metadata } from "next";
import { ListaTarefasPessoa } from "@/components/painel/lista-tarefas";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { tarefas } from "@/lib/painel/dados";

export const metadata: Metadata = { title: "Minhas tarefas" };

export default async function MinhasTarefas() {
  const eu = await exigirPessoa("/painel/minhas-tarefas");
  const lista = await comoUsuario(eu.authId, (q) => tarefas(q, { pessoa: eu.id }));
  return (
    <>
      <TopoPagina titulo="Minhas tarefas" />
      <ConteudoPagina className="max-w-[1000px]">
        <ListaTarefasPessoa tarefas={lista} pessoaId={eu.id} />
      </ConteudoPagina>
    </>
  );
}
