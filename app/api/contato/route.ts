import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { esquemaContato, paraRegistro } from "@/lib/validacao/contato";

// POST /api/contato (seção 6.6): valida, confere o Turnstile, limita a 5 envios
// por IP por hora e grava pelo service role. A função registrar_contato (SQL)
// faz tudo numa transação: limite, contato, tarefa "Responder contato" e atribuição.

export const runtime = "nodejs";

function erro(status: number, codigo: string, mensagem: string, campos?: Record<string, string>) {
  return NextResponse.json({ erro: { codigo, mensagem, ...(campos ? { campos } : {}) } }, { status });
}

function ipDe(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    ""
  );
}

async function conferirTurnstile(token: string, ip: string) {
  const segredo = process.env.TURNSTILE_SECRET_KEY;
  if (!segredo) return false;
  const corpo = new URLSearchParams({ secret: segredo, response: token });
  if (ip) corpo.set("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: corpo,
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json()) as { success?: boolean };
    return j.success === true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return erro(400, "json_invalido", "Não entendemos o envio. Recarregue a página e tente de novo.");
  }

  const { token, ...dados } = corpo ?? {};
  const validacao = esquemaContato.safeParse(dados);
  if (!validacao.success) {
    const campos: Record<string, string> = {};
    for (const problema of validacao.error.issues) {
      const campo = String(problema.path[0] ?? "formulario");
      campos[campo] ??= problema.message;
    }
    return erro(400, "dados_invalidos", "Confira os campos marcados.", campos);
  }

  if (typeof token !== "string" || !token) {
    return erro(400, "sem_verificacao", "Conclua a verificação anti-spam e envie de novo.");
  }
  const ip = ipDe(req);
  if (!(await conferirTurnstile(token, ip))) {
    return erro(400, "verificacao_falhou", "A verificação anti-spam não passou. Tente enviar de novo.");
  }

  const db = supabaseAdmin();
  if (!db) {
    console.error("[contato] Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
    return erro(503, "indisponivel", "O envio está fora do ar no momento. Tente de novo mais tarde.");
  }

  // O IP nunca é guardado: só um HMAC dele, para o limite de envios por hora.
  const ipHash = createHmac("sha256", process.env.TURNSTILE_SECRET_KEY!)
    .update(ip || "sem-ip")
    .digest("hex");

  const { data, error } = await db.rpc("registrar_contato", {
    p_dados: paraRegistro(validacao.data),
    p_ip_hash: ipHash,
  });

  if (error) {
    if (error.code === "P0429" || error.message.includes("limite_de_envios")) {
      return erro(429, "limite", "Você já enviou várias mensagens na última hora. Tente de novo mais tarde.");
    }
    console.error("[contato] falha ao gravar:", error);
    return erro(500, "falha", "Não conseguimos gravar sua mensagem. Tente de novo em alguns minutos.");
  }

  return NextResponse.json({ ok: true, id: data }, { status: 201 });
}
