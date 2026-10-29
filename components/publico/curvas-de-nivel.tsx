import { cn } from "@/lib/utils";
import { curvas, type ConjuntoCurvas } from "./curvas-dados";

// Curvas de nível (seção 4.7). Os caminhos ficam uma vez só na página, em
// <DefinicoesCurvas /> (curvas-definicoes.tsx, no layout público), e cada uso
// referencia com <use>. Isso evita repetir os mesmos ~14 KB de SVG em cada mapa.

export const idCurvas = (conjunto: ConjuntoCurvas) => `curvas-${conjunto}`;

// A cor vem de currentColor; defina com classes de texto (ex.: text-caramelo/25).
export function CurvasDeNivel({
  conjunto = "hero",
  className,
  enquadramento = "slice",
}: {
  conjunto?: ConjuntoCurvas;
  className?: string;
  enquadramento?: "slice" | "meet";
}) {
  const c = curvas[conjunto];
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${c.largura} ${c.altura}`}
      preserveAspectRatio={`xMidYMid ${enquadramento}`}
      className={cn("pointer-events-none", className)}
    >
      <use href={`#${idCurvas(conjunto)}`} stroke="currentColor" />
    </svg>
  );
}
