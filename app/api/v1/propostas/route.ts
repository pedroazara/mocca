import { comApi } from "@/lib/api/rota";
import { esquemaStatusProposta, listarPropostas, validar } from "@/lib/api/servico";

export const dynamic = "force-dynamic";

// GET /api/v1/propostas?status=pendente|aprovada|recusada|falhou
export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status") || null;
  return comApi(req, async () => listarPropostas(validar(esquemaStatusProposta, status)));
}
