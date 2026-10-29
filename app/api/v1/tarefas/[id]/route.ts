import { comApi, corpoJson } from "@/lib/api/rota";
import { atualizarTarefa, esquemaAtualizacao, validar, verTarefa } from "@/lib/api/servico";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  return comApi(req, () => verTarefa(id));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return comApi(req, async () => atualizarTarefa(id, validar(esquemaAtualizacao, await corpoJson(req))));
}
