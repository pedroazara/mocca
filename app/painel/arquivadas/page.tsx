import type { Metadata } from "next";
import { ListaArquivadas } from "@/components/painel/arquivadas";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { tarefasArquivadas } from "@/lib/painel/arquivadas";

export const metadata: Metadata = { title: "Arquivadas" };

export default async function Arquivadas() {
  const eu = await exigirPessoa("/painel/arquivadas");
  const lista = await comoUsuario(eu.authId, tarefasArquivadas);
  return (
    <>
      <TopoPagina titulo="Arquivadas" migalhas={[{ href: "/painel/quadro", rotulo: "Quadro" }]} />
      <ConteudoPagina className="max-w-[1000px]">
        <ListaArquivadas tarefas={lista} />
      </ConteudoPagina>
    </>
  );
}
