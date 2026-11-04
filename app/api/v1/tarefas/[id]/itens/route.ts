import { z } from "zod";
import { comApi, corpoJson } from "@/lib/api/rota";
import { adicionarItem, esquemaTextoItem, validar } from "@/lib/api/servico";

export const dynamic = "force-dynamic";
const esquema = z.object({ pessoa: z.string().min(1), texto: esquemaTextoItem });

// POST /api/v1/tarefas/{id}/itens  { pessoa, texto }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comApi(
    req,
    async (token) => {
      const c = validar(esquema, await corpoJson(req));
      return adicionarItem(id, c.pessoa, c.texto, token);
    },
    202,
  );
}
