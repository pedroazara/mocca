import { DetalheTarefa, TarefaNaoEncontrada } from "@/components/painel/detalhe-tarefa";
import { JanelaTarefa } from "@/components/painel/janela-tarefa";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { tarefa } from "@/lib/painel/dados";

// Ao clicar numa tarefa dentro do painel, ela abre na janela central (DUVIDAS 4h).
export default async function TarefaNaJanela({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eu = await exigirPessoa(`/painel/tarefas/${id}`);
  const t = /^[0-9a-f-]{36}$/i.test(id) ? await comoUsuario(eu.authId, (q) => tarefa(q, id)) : null;
  return (
    <JanelaTarefa
      titulo={t?.titulo ?? "Tarefa"}
      rotulo={t?.semana ? `Semana ${t.semana}` : "Sem semana"}
      hrefPagina={`/painel/tarefas/${id}`}
    >
      {t ? <DetalheTarefa tarefa={t} /> : <TarefaNaoEncontrada />}
    </JanelaTarefa>
  );
}
