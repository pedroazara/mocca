import { pessoaLogada } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";

export const dynamic = "force-dynamic";

// GET /painel/anexos/:id: foto ou PDF da entrega da semana; com ?mini, a
// miniatura da foto. Só a equipe vê: a leitura é como a pessoa logada, com RLS.
// O arquivo não muda depois de enviado, então fica no cache do navegador (e só
// nele). O PDF abre no leitor do navegador; o nome vai junto para o download.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const eu = await pessoaLogada();
  if (!eu) return new Response(null, { status: 401 });
  const mini = new URL(req.url).searchParams.has("mini");
  const [linha] = await comoUsuario(eu.authId, (q) =>
    q<{ tipo: "foto" | "pdf"; nome: string; dados: string | null }>(
      `select tipo, nome, encode(${mini ? "miniatura" : "arquivo"}, 'base64') as dados from anexo_entrega where id = $1`,
      [id],
    ),
  );
  if (!linha?.dados) return new Response(null, { status: 404 });
  return new Response(Buffer.from(linha.dados, "base64"), {
    headers: {
      "Content-Type": linha.tipo === "pdf" ? "application/pdf" : "image/jpeg",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(linha.nome)}`,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
