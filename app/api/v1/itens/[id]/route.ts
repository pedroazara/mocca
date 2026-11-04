import { z } from "zod";
import { comApi, corpoJson } from "@/lib/api/rota";
import { atualizarItem, esquemaTextoItem, validar } from "@/lib/api/servico";

export const dynamic = "force-dynamic";
const esquema = z.object({ feito: z.boolean().optional(), texto: esquemaTextoItem.optional() });

// PATCH /api/v1/itens/{id}  { feito, texto }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comApi(req, async (token) => atualizarItem(id, validar(esquema, await corpoJson(req)), token), 202);
}
