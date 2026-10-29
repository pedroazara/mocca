import "server-only";
import { NextResponse } from "next/server";
import { ErroApi, validarToken } from "./servico";

// Envelope das rotas /api/v1: valida o token, aplica o limite e devolve erros
// no formato { "erro": { "codigo": "...", "mensagem": "..." } } (seção 11.2).
export async function comApi(req: Request, fn: () => Promise<unknown>, status = 200) {
  try {
    await validarToken(req.headers.get("authorization"));
    return NextResponse.json(await fn(), { status });
  } catch (e) {
    if (e instanceof ErroApi)
      return NextResponse.json({ erro: { codigo: e.codigo, mensagem: e.message, ...e.extra } }, { status: e.status });
    console.error("[api/v1]", e);
    return NextResponse.json({ erro: { codigo: "interno", mensagem: "Erro interno. Tente de novo." } }, { status: 500 });
  }
}

export async function corpoJson(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new ErroApi(400, "json_invalido", "O corpo precisa ser JSON.");
  }
}
