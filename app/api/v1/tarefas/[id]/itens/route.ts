import { z } from "zod";
import { comApi, corpoJson } from "@/lib/api/rota";
import { adicionarItem, validar } from "@/lib/api/servico";

export const dynamic = "force-dynamic";
const esquema = z.object({ pessoa: z.string().min(1), texto: z.string().trim().min(1).max(500) });

// POST /api/v1/tarefas/{id}/itens  { pessoa, texto }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comApi(
    req,
    async () => {
      const c = validar(esquema, await corpoJson(req));
      return adicionarItem(id, c.pessoa, c.texto);
    },
    201,
  );
}
