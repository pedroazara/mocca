import { comApi } from "@/lib/api/rota";
import { pautaProximaReuniao } from "@/lib/api/servico";

export const dynamic = "force-dynamic";

// GET /api/v1/reunioes/proxima: pauta gerada da próxima reunião
export async function GET(req: Request) {
  return comApi(req, () => pautaProximaReuniao());
}
