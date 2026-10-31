import type { Metadata } from "next";
import { GradeEquipe } from "@/components/painel/equipe";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { perfis, tarefas } from "@/lib/painel/dados";

export const metadata: Metadata = { title: "Equipe" };

export default async function Equipe() {
  const eu = await exigirPessoa("/painel/equipe");
  const { lista, listaPerfis } = await comoUsuario(eu.authId, async (q) => ({
    lista: await tarefas(q),
    listaPerfis: await perfis(q),
  }));
  return (
    <>
      <TopoPagina titulo="Equipe" />
      <ConteudoPagina>
        <GradeEquipe tarefas={lista} perfis={listaPerfis} />
      </ConteudoPagina>
    </>
  );
}
