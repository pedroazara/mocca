import { useId } from "react";
import { cn } from "@/lib/utils";
import { produtividade } from "./produtividade-dados";

// Mapa de produtividade ilustrativo do hero. As curvas de nível do fundo passam
// por dentro da lavoura, e as faixas entre elas ganham, aos poucos, as 5 cores
// da legenda, até a mancha mais forte, onde fica o pin. O desenho é maior que a
// caixa: as curvas em volta saem dela e se apagam nas bordas (a seção corta o
// que passar). Dados gerados por scripts/gerar-produtividade.mjs. Valores inventados.

const PREENCHIMENTO = ["", "fill-talhao-1", "fill-talhao-2", "fill-talhao-3", "fill-talhao-4", "fill-talhao-5"];

export function MapaProdutividade({ className }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { largura, altura, janela, linhas, faixas, pin } = produtividade;
  const pct = (v: number, base: number) => `${(v / base) * 100}%`;

  return (
    <div
      role="img"
      aria-label="Mapa ilustrativo de produtividade de uma lavoura de café: as curvas de nível ganham cor onde se colheu mais, e um pin marca a área mais produtiva."
      className={cn("relative aspect-[600/460] w-full", className)}
    >
      <svg
        aria-hidden
        focusable="false"
        viewBox={`0 0 ${largura} ${altura}`}
        className="pointer-events-none absolute -z-10 max-w-none text-caramelo"
        style={{
          left: pct(-janela.x, janela.largura),
          top: pct(-janela.y, janela.altura),
          width: pct(largura, janela.largura),
          height: pct(altura, janela.altura),
        }}
      >
        <defs>
          {/* tudo se apaga do centro para as bordas */}
          <radialGradient id={`${id}-g`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.42" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </radialGradient>
          <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x={0} y={0} width={largura} height={altura}>
            <rect width={largura} height={altura} fill={`url(#${id}-g)`} />
          </mask>
        </defs>

        <g mask={`url(#${id}-m)`}>
          {faixas.map((f, i) => (
            <path key={i} d={f.d} fillRule="evenodd" className={PREENCHIMENTO[f.cor]} fillOpacity={f.opacidade} />
          ))}
          <path
            d={linhas}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.4}
            strokeWidth={1}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>

        <circle cx={pin[0]} cy={pin[1]} r={4.5} className="fill-texto stroke-fundo" strokeWidth={2} />
        <image href="/logo/mocca-simbolo.svg" x={pin[0] - 14} y={pin[1] - 44} width={28} height={39} />
      </svg>
    </div>
  );
}
