import type { Metadata } from "next";
import { ArquivosDoDrive } from "@/components/painel/arquivos";
import { ConteudoPagina, TopoPagina } from "@/components/painel/topo";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { estadoDoDrive, paraTela } from "@/lib/drive";
import { usosPorArquivo } from "@/lib/drive/arvore";
import { linksDoDrive } from "@/lib/painel/arquivos";
import { pessoas } from "@/lib/painel/dados";

export const metadata: Metadata = { title: "Arquivos" };

export default async function Arquivos() {
  const eu = await exigirPessoa("/painel/arquivos");
  const [drive, { links, equipe }] = await Promise.all([
    estadoDoDrive(),
    comoUsuario(eu.authId, async (q) => ({ links: await linksDoDrive(q), equipe: await pessoas(q) })),
  ]);
  const estado = paraTela(drive, { admin: eu.papel === "admin", equipe });
  const usos = "arvore" in estado ? usosPorArquivo(links, estado.arvore.itens) : {};

  return (
    <>
      <TopoPagina titulo="Arquivos" />
      <ConteudoPagina className="max-w-[1000px]">
        <p className="medida mb-6 text-texto-2">
          A pasta do projeto no Google Drive, com o que está ligado a cada tarefa e semana. Os arquivos abrem no Drive, com a sua conta Google.
        </p>
        <ArquivosDoDrive estado={estado} usos={usos} />
      </ConteudoPagina>
    </>
  );
}
