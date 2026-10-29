import type { Metadata } from "next";
import { FiltrosQuadro } from "@/components/painel/filtros-quadro";
import { Kanban } from "@/components/painel/kanban";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { semanas, tarefas } from "@/lib/painel/dados";
import { semanaAtual } from "@/lib/painel/datas";

export const metadata: Metadata = { title: "Quadro" };

const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

export default async function Quadro({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; pessoa?: string; etiqueta?: string; atrasadas?: string; feitas?: string }>;
}) {
  const sp = await searchParams;
  const eu = await exigirPessoa("/painel/quadro");
  const { lista, semana } = await comoUsuario(eu.authId, async (q) => {
    const atual = semanaAtual(await semanas(q))?.numero ?? 1;
    const semana = sp.semana === "todas" ? null : Number(sp.semana) || atual;
    const lista = await tarefas(q, {
      semana,
      pessoa: uuid(sp.pessoa),
      etiqueta: uuid(sp.etiqueta),
      atrasadas: sp.atrasadas === "1",
    });
    return { lista, semana };
  });

  return (
    <>
      <TopoPagina titulo="Quadro" semanaNovaTarefa={semana ?? undefined} />
      <ConteudoPagina>
        <FiltrosQuadro />
        <Kanban
          key={JSON.stringify(sp)}
          tarefas={lista}
          semanaFiltro={semana}
          feitasTodas={sp.feitas === "todas"}
        />
      </ConteudoPagina>
    </>
  );
}
