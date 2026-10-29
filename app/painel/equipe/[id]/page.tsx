import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListaTarefasPessoa } from "@/components/painel/lista-tarefas";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { pessoas, tarefas } from "@/lib/painel/dados";

export const metadata: Metadata = { title: "Tarefas da pessoa" };

export default async function TarefasDaPessoa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eu = await exigirPessoa(`/painel/equipe/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { p, lista } = await comoUsuario(eu.authId, async (q) => ({
    p: (await pessoas(q)).find((x) => x.id === id),
    lista: await tarefas(q, { pessoa: id }),
  }));
  if (!p) notFound();
  return (
    <>
      <TopoPagina titulo={`Tarefas de ${p.apelido ?? p.nome}`} migalhas={[{ href: "/painel/equipe", rotulo: "Equipe" }]} />
      <ConteudoPagina className="max-w-[1000px]">
        <ListaTarefasPessoa tarefas={lista} pessoaId={p.id} />
      </ConteudoPagina>
    </>
  );
}
