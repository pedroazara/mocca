import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PaginaAprovacoes } from "@/components/painel/aprovacoes";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { propostasDecididas, propostasPendentes } from "@/lib/painel/dados";

export const metadata: Metadata = { title: "Aprovações" };

export default async function Aprovacoes() {
  const eu = await exigirPessoa("/painel/aprovacoes");
  if (eu.papel !== "admin") redirect("/painel");
  const d = await comoUsuario(eu.authId, async (q) => ({
    pendentes: await propostasPendentes(q),
    decididas: await propostasDecididas(q),
  }));
  return (
    <>
      <TopoPagina titulo="Aprovações" />
      <ConteudoPagina className="max-w-[1000px]">
        <PaginaAprovacoes pendentes={d.pendentes} decididas={d.decididas} />
      </ConteudoPagina>
    </>
  );
}
