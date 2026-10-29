import { comApi } from "@/lib/api/rota";
import { listarPessoas } from "@/lib/api/servico";

export const dynamic = "force-dynamic";

// GET /api/v1/pessoas: pessoas ativas (id, nome, apelido, frente)
export async function GET(req: Request) {
  return comApi(req, async () => (await listarPessoas()).map(({ id, nome, apelido, frente }) => ({ id, nome, apelido, frente })));
}
