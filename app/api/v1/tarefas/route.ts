import { comApi, corpoJson } from "@/lib/api/rota";
import { criarTarefa, esquemaNovaTarefa, listarTarefas, validar } from "@/lib/api/servico";
import type { Status } from "@/lib/painel/tipos";

export const dynamic = "force-dynamic";

// GET /api/v1/tarefas?semana=&pessoa=&status=&etiqueta=&atrasadas=true
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  return comApi(req, () =>
    listarTarefas({
      semana: p.get("semana") ? Number(p.get("semana")) : null,
      pessoa: p.get("pessoa"),
      status: (p.get("status") as Status) || null,
      etiqueta: p.get("etiqueta"),
      atrasadas: p.get("atrasadas") === "true",
    }),
  );
}

// POST /api/v1/tarefas: cria com atribuições, itens e documentos numa transação
export async function POST(req: Request) {
  return comApi(req, async () => criarTarefa(validar(esquemaNovaTarefa, await corpoJson(req))), 201);
}
