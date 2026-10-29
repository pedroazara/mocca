import { DetalheTarefa, TarefaNaoEncontrada } from "@/components/painel/detalhe-tarefa";
import { PainelLateral } from "@/components/painel/painel-lateral";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { tarefa } from "@/lib/painel/dados";

// Ao clicar numa tarefa dentro do painel, ela abre no painel lateral (seção 9.4).
export default async function TarefaNoPainelLateral({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eu = await exigirPessoa(`/painel/tarefas/${id}`);
  const t = /^[0-9a-f-]{36}$/i.test(id) ? await comoUsuario(eu.authId, (q) => tarefa(q, id)) : null;
  return (
    <PainelLateral titulo={t?.titulo ?? "Tarefa"} hrefPagina={`/painel/tarefas/${id}`}>
      {t ? <DetalheTarefa tarefa={t} /> : <TarefaNaoEncontrada />}
    </PainelLateral>
  );
}
