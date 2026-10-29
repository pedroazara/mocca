import { Cabecalho } from "@/components/publico/cabecalho";
import { DefinicoesCurvas } from "@/components/publico/curvas-definicoes";
import { Rodape } from "@/components/publico/rodape";

export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-m bg-botao-primario px-4 py-2 text-botao-primario-texto focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <DefinicoesCurvas />
      <Cabecalho />
      <main id="conteudo">{children}</main>
      <Rodape />
    </>
  );
}
