import { pessoaLogada } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { contatos } from "@/lib/painel/dados";
import { PERFIS_CONTATO } from "@/lib/painel/tipos";

// Exporta os contatos em CSV (seção 9.7), com os filtros da tela.
export async function GET(req: Request) {
  const eu = await pessoaLogada();
  if (!eu) return new Response("Não autorizado", { status: 401 });
  const url = new URL(req.url);
  const lista = await comoUsuario(eu.authId, (q) =>
    contatos(q, { perfil: url.searchParams.get("perfil"), status: url.searchParams.get("status") }),
  );
  const cel = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cabecalho = ["data", "nome", "email", "telefone", "perfil", "cidade_uf", "area_ha", "tipo_colheita", "status", "mensagem", "notas"];
  const linhas = lista.map((c) =>
    [c.criado_em, c.nome, c.email, c.telefone, PERFIS_CONTATO[c.perfil], c.cidade_uf, c.area_ha, c.tipo_colheita, c.status, c.mensagem, c.notas]
      .map(cel)
      .join(";"),
  );
  // BOM para o Excel abrir os acentos certo; ponto e vírgula é o separador do Excel em pt-BR
  const corpo = "\uFEFF" + [cabecalho.join(";"), ...linhas].join("\r\n");
  const hoje = new Date().toISOString().slice(0, 10);
  return new Response(corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contatos-mocca-${hoje}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
