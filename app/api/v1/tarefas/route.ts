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

// POST /api/v1/tarefas: propõe tarefa com atribuições, itens e documentos (202: espera a aprovação do admin)
export async function POST(req: Request) {
  return comApi(req, async (token) => criarTarefa(validar(esquemaNovaTarefa, await corpoJson(req)), token), 202);
}
