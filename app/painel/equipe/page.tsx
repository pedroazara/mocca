import type { Metadata } from "next";
import { GradeEquipe } from "@/components/painel/equipe";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { tarefas } from "@/lib/painel/dados";

export const metadata: Metadata = { title: "Equipe" };

export default async function Equipe() {
  const eu = await exigirPessoa("/painel/equipe");
  const lista = await comoUsuario(eu.authId, (q) => tarefas(q));
  return (
    <>
      <TopoPagina titulo="Equipe" />
      <ConteudoPagina>
        <GradeEquipe tarefas={lista} />
      </ConteudoPagina>
    </>
  );
}
