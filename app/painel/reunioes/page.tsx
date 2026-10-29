import type { Metadata } from "next";
import { ListaReunioes } from "@/components/painel/reunioes";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { reunioes } from "@/lib/painel/dados";

export const metadata: Metadata = { title: "Reuniões" };

export default async function Reunioes() {
  const eu = await exigirPessoa("/painel/reunioes");
  const lista = await comoUsuario(eu.authId, (q) => reunioes(q));
  return (
    <>
      <TopoPagina titulo="Reuniões" />
      <ConteudoPagina className="max-w-[1000px]">
        <ListaReunioes reunioes={lista} />
      </ConteudoPagina>
    </>
  );
}
