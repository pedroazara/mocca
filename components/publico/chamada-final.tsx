import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Botao } from "@/components/ui/botao";
import { CurvasDeNivel } from "./curvas-de-nivel";

// Chamada final (seção 6.3, bloco 7): fundo espresso, texto creme, curvas de nível.
export function ChamadaFinal({
  titulo = "Quer testar o MoCCa na sua lavoura?",
  texto = "Estamos procurando produtores e parceiros para os testes de campo. Se a sua fazenda já usa mapas de solo ou de adubação, queremos pôr o mapa da colheita ao lado deles.",
}: {
  titulo?: string;
  texto?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-espresso text-creme">
      <CurvasDeNivel conjunto="hero" className="absolute inset-0 -z-10 h-full w-full text-creme/[0.12]" />
      <div className="conteiner flex flex-col items-start gap-8 py-20 md:flex-row md:items-end md:justify-between md:py-28">
        <div>
          <h2 className="t-h1 max-w-[18ch] text-creme md:text-[2.75rem]">{titulo}</h2>
          <p className="medida mt-4 text-creme/85">{texto}</p>
        </div>
        <Botao asChild variante="claro" className="shrink-0">
          <Link href="/contato">
            Fale com a equipe
            <ArrowRight aria-hidden />
          </Link>
        </Botao>
      </div>
    </section>
  );
}
