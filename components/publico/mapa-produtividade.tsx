import { useId } from "react";
import { cn } from "@/lib/utils";
import { produtividade } from "./produtividade-dados";

// Mapa de produtividade ilustrativo do hero: uma lavoura com manchas de produção
// em 5 faixas (as mesmas cores da legenda) e um pin na mancha mais forte.
// Dados gerados por scripts/gerar-produtividade.mjs. Valores inventados.

const M = 10;
const preenchimento = ["fill-talhao-2", "fill-talhao-3", "fill-talhao-4", "fill-talhao-5"];

export function MapaProdutividade({ className }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { largura, altura, contorno, faixas, pin } = produtividade;

  return (
    <svg
      role="img"
      aria-label="Mapa ilustrativo de produtividade de uma lavoura de café: manchas de cores diferentes mostram onde se colheu mais e onde se colheu menos, e um pin marca a área mais produtiva."
      viewBox={`${-M} ${-M} ${largura + 2 * M} ${altura + 2 * M}`}
      className={cn("block h-auto w-full", className)}
    >
      <defs>
        <clipPath id={`${id}-lavoura`}>
          <path d={contorno} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id}-lavoura)`}>
        <rect x={0} y={0} width={largura} height={altura} className="fill-talhao-1" />
        {faixas.map((d, i) => (
          <path key={i} d={d} fillRule="evenodd" className={preenchimento[i]} />
        ))}
        {/* divisas finas entre as faixas, como curvas de nível */}
        {faixas.map((d, i) => (
          <path key={i} d={d} fill="none" className="stroke-fundo" strokeOpacity={0.6} strokeWidth={1.2} />
        ))}
      </g>
      <path d={contorno} fill="none" className="stroke-texto" strokeOpacity={0.45} strokeWidth={1.5} />

      <circle cx={pin[0]} cy={pin[1]} r={4.5} className="fill-texto stroke-fundo" strokeWidth={2} />
      <image href="/logo/mocca-simbolo.svg" x={pin[0] - 14} y={pin[1] - 44} width={28} height={39} />
    </svg>
  );
}
