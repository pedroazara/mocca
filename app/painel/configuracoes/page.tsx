import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PaginaConfiguracoes } from "@/components/painel/configuracoes";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { configuracao, tokens } from "@/lib/painel/dados";

export const metadata: Metadata = { title: "Configurações" };

export default async function Configuracoes() {
  const eu = await exigirPessoa("/painel/configuracoes");
  if (eu.papel !== "admin") redirect("/painel");
  const d = await comoUsuario(eu.authId, async (q) => ({ config: await configuracao(q), tokens: await tokens(q) }));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return (
    <>
      <TopoPagina titulo="Configurações" />
      <ConteudoPagina className="max-w-[1000px]">
        <PaginaConfiguracoes config={d.config} tokens={d.tokens} siteUrl={siteUrl} />
      </ConteudoPagina>
    </>
  );
}
