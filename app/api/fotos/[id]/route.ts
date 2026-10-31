import { comoServico } from "@/lib/banco";

export const dynamic = "force-dynamic";

// GET /api/fotos/:id?v=...: foto pública da pessoa (página Equipe). O `v` muda a
// cada foto nova, então a resposta pode ficar em cache para sempre.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const [linha] = await comoServico((q) =>
    q<{ foto: string }>("select encode(foto, 'base64') as foto from perfil_publico where pessoa_id = $1 and foto is not null", [id]),
  );
  if (!linha) return new Response(null, { status: 404 });
  return new Response(Buffer.from(linha.foto, "base64"), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" },
  });
}
