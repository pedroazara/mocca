import { comApi } from "@/lib/api/rota";
import { removerAtribuicao } from "@/lib/api/servico";

export const dynamic = "force-dynamic";

// DELETE /api/v1/tarefas/{id}/atribuicoes/{pessoa}
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; pessoa: string }> }) {
  const { id, pessoa } = await params;
  return comApi(req, () => removerAtribuicao(id, decodeURIComponent(pessoa)));
}
