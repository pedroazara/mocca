import type { Metadata } from "next";
import { TabelaContatos } from "@/components/painel/contatos";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { contato, contatos } from "@/lib/painel/dados";

export const metadata: Metadata = { title: "Contatos" };

export default async function Contatos({ searchParams }: { searchParams: Promise<{ id?: string; perfil?: string; status?: string }> }) {
  const sp = await searchParams;
  const eu = await exigirPessoa("/painel/contatos");
  const { lista, aberto } = await comoUsuario(eu.authId, async (q) => ({
    lista: await contatos(q, { perfil: sp.perfil || null, status: sp.status || null }),
    aberto: sp.id && /^[0-9a-f-]{36}$/i.test(sp.id) ? await contato(q, sp.id) : null,
  }));
  return (
    <>
      <TopoPagina titulo="Contatos" />
      <ConteudoPagina>
        <TabelaContatos contatos={lista} aberto={aberto} />
      </ConteudoPagina>
    </>
  );
}
