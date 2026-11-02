import type { Metadata } from "next";
import { LinhaDoTempoSemanas } from "@/components/painel/semanas";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { tarefas } from "@/lib/painel/dados";

export const metadata: Metadata = { title: "Cronograma" };

export default async function Semanas() {
  const eu = await exigirPessoa("/painel/semanas");
  const lista = await comoUsuario(eu.authId, (q) => tarefas(q));
  return (
    <>
      <TopoPagina titulo="Cronograma" />
      <ConteudoPagina>
        <p className="medida mb-6 text-texto-2">
          As 12 semanas do Avança Café, com a entrega de cada uma e o andamento das tarefas.
        </p>
        <LinhaDoTempoSemanas tarefas={lista} />
      </ConteudoPagina>
    </>
  );
}
