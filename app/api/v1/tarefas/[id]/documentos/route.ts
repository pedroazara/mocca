import { comApi, corpoJson } from "@/lib/api/rota";
import { adicionarDocumento, esquemaDocumento, validar } from "@/lib/api/servico";

export const dynamic = "force-dynamic";

// POST /api/v1/tarefas/{id}/documentos  { titulo, url, tipo }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comApi(req, async () => adicionarDocumento(id, validar(esquemaDocumento, await corpoJson(req))), 201);
}
