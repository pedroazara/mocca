import type { Metadata } from "next";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { VisaoSemana } from "@/components/painel/visao-semana";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { carregarSemana } from "@/lib/painel/carregar";

export const metadata: Metadata = { title: "Semana" };

export default async function PaginaSemana({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { semana: s } = await searchParams;
  const eu = await exigirPessoa();
  const d = await comoUsuario(eu.authId, (q) => carregarSemana(q, s ? Number(s) : undefined));

  return (
    <>
      <TopoPagina titulo="Semana" semanaNovaTarefa={d.semana?.numero} />
      <ConteudoPagina>
        {d.semana ? (
          <VisaoSemana
            semana={d.semana}
            tarefas={d.tarefas}
            contatosNovos={d.contatosNovos}
            documentosSemana={d.documentosSemana}
            proxima={d.proxima}
          />
        ) : (
          <p className="text-texto-2">As semanas do programa ainda não foram cadastradas.</p>
        )}
      </ConteudoPagina>
    </>
  );
}
