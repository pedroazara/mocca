import { comApi, corpoJson } from "@/lib/api/rota";
import { atribuir, esquemaAtribuicao, validar } from "@/lib/api/servico";

export const dynamic = "force-dynamic";

// POST /api/v1/tarefas/{id}/atribuicoes  { pessoa, papel, itens: [texto] }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comApi(req, async () => atribuir(id, validar(esquemaAtribuicao, await corpoJson(req))), 201);
}
