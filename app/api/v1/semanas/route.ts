import { comApi } from "@/lib/api/rota";
import { listarSemanas } from "@/lib/api/servico";

export const dynamic = "force-dynamic";

// GET /api/v1/semanas[?atual=true]
export async function GET(req: Request) {
  return comApi(req, () => listarSemanas(new URL(req.url).searchParams.get("atual") === "true"));
}
