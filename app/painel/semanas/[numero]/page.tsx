import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetalhesSemana } from "@/components/painel/semanas";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { VisaoSemana } from "@/components/painel/visao-semana";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { carregarSemana } from "@/lib/painel/carregar";

export const metadata: Metadata = { title: "Semana do programa" };

export default async function PaginaSemanaDoPrograma({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  const n = Number(numero);
  const eu = await exigirPessoa(`/painel/semanas/${numero}`);
  const d = await comoUsuario(eu.authId, (q) => carregarSemana(q, n));
  if (!d.semana || d.semana.numero !== n) notFound();

  return (
    <>
      <TopoPagina
        titulo={`Semana ${n}`}
        migalhas={[{ href: "/painel/semanas", rotulo: "Semanas do programa" }]}
        semanaNovaTarefa={n}
      />
      <ConteudoPagina className="flex flex-col gap-8">
        <VisaoSemana
          semana={d.semana}
          tarefas={d.tarefas}
          contatosNovos={d.contatosNovos}
          documentosSemana={d.documentosSemana}
          proxima={d.proxima}
          base="/painel/semanas"
        />
        <DetalhesSemana key={d.semana.id + (d.semana.anotacoes ?? "")} semana={d.semana} documentos={d.documentosSemana} />
      </ConteudoPagina>
    </>
  );
}
