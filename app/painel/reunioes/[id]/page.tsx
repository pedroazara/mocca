import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaReuniao } from "@/components/painel/reunioes";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import * as dados from "@/lib/painel/dados";
import { dataLonga } from "@/lib/painel/datas";
import { montarPauta, reuniaoAnteriorA } from "@/lib/painel/pauta";

export const metadata: Metadata = { title: "Reunião" };

export default async function Reuniao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eu = await exigirPessoa(`/painel/reunioes/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await comoUsuario(eu.authId, async (q) => {
    const r = await dados.reuniao(q, id);
    if (!r) return null;
    const [semanas, tarefas, contatos, reunioes, criadas] = [
      await dados.semanas(q),
      await dados.tarefas(q),
      await dados.contatos(q, { status: "novo" }),
      await dados.reunioes(q),
      await dados.tarefas(q, { reuniao: id }),
    ];
    const pauta = montarPauta({ semanas, tarefas, contatos, dataReuniao: r.data, reuniaoAnterior: reuniaoAnteriorA(reunioes, r.data) });
    return { r, pauta, criadas };
  });
  if (!d) notFound();
  const titulo = dataLonga(d.r.data);
  return (
    <>
      <TopoPagina titulo={titulo.charAt(0).toUpperCase() + titulo.slice(1)} migalhas={[{ href: "/painel/reunioes", rotulo: "Reuniões" }]} />
      <ConteudoPagina>
        <PaginaReuniao key={d.r.id + (d.r.anotacoes ?? "")} reuniao={d.r} pauta={d.pauta} criadas={d.criadas} />
      </ConteudoPagina>
    </>
  );
}
