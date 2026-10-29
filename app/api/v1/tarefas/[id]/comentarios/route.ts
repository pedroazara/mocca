import { z } from "zod";
import { comApi, corpoJson } from "@/lib/api/rota";
import { comentar, validar } from "@/lib/api/servico";

export const dynamic = "force-dynamic";
const esquema = z.object({ texto: z.string().trim().min(1).max(5000) });

// POST /api/v1/tarefas/{id}/comentarios  { texto }  (autor exibido como "Claude")
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comApi(req, async () => comentar(id, validar(esquema, await corpoJson(req)).texto), 201);
}
