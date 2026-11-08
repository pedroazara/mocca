import type { Metadata } from "next";
import { PaginaLinks } from "@/components/painel/links";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { links } from "@/lib/painel/dados";

export const metadata: Metadata = { title: "Links" };

export default async function Links() {
  const eu = await exigirPessoa("/painel/links");
  const lista = await comoUsuario(eu.authId, (q) => links(q));
  return (
    <>
      <TopoPagina titulo="Links" />
      <ConteudoPagina className="max-w-[1000px]">
        <PaginaLinks links={lista} />
      </ConteudoPagina>
    </>
  );
}
