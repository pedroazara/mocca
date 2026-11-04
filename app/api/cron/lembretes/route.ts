import { timingSafeEqual } from "node:crypto";
import { addDays, format, parseISO } from "date-fns";
import { NextResponse } from "next/server";
import { enviarLembretes } from "@/lib/email";
import { hojeBrasilia } from "@/lib/painel/datas";

// GET /api/cron/lembretes: o lembrete da véspera do prazo (fase 4). A Vercel
// chama todo dia às 8h de Brasília (vercel.json) com o cabeçalho
// "Authorization: Bearer <CRON_SECRET>". Sem CRON_SECRET, a rota não responde.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const amanha = format(addDays(parseISO(hojeBrasilia()), 1), "yyyy-MM-dd");
  try {
    const r = await enviarLembretes(amanha);
    console.info(`[lembretes] ${amanha}: ${r.tarefas} tarefas, ${r.emails} e-mails, ${r.enviados} enviados`);
    return NextResponse.json({ dia: amanha, ...r });
  } catch (e) {
    console.error("[lembretes]", e);
    return NextResponse.json({ erro: "falha ao montar os lembretes" }, { status: 500 });
  }
}
