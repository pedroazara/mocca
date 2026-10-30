import { useId } from "react";
import { gerarMapa, posicaoNaTela, type Mapa, type Nivel } from "@/lib/talhoes";
import { cn } from "@/lib/utils";
import { idCurvas } from "./curvas-de-nivel";
import { curvas } from "./curvas-dados";

export const preenchimento: Record<Nivel, string> = {
  1: "fill-talhao-1",
  2: "fill-talhao-2",
  3: "fill-talhao-3",
  4: "fill-talhao-4",
  5: "fill-talhao-5",
};

export const mapas = {
  // semente escolhida para o talhão 07 (cartão flutuante) cair no meio do mapa
  grande: gerarMapa({ largura: 720, altura: 520, faixas: 5, porFaixa: [3, 5], semente: 4, angulo: -3 }),
  mini: gerarMapa({
    largura: 240,
    altura: 150,
    faixas: 3,
    porFaixa: [3, 4],
    semente: 77,
    inclinacao: 16,
    curvatura: 6,
  }),
} satisfies Record<string, Mapa>;

export type VarianteMapa = keyof typeof mapas;

// Grade de talhões (seção 4.7): mapa de produção ilustrativo.
// O vão entre talhões é um traço na cor do fundo da seção (classe stroke-*).
export function GradeTalhoes({
  variante,
  numeros = false,
  uniforme = false,
  contorno = true,
  destaque,
  corDoVao = "stroke-fundo",
  className,
  titulo,
}: {
  variante: VarianteMapa;
  numeros?: boolean;
  uniforme?: boolean;
  contorno?: boolean;
  destaque?: number;
  corDoVao?: string;
  className?: string;
  titulo: string;
}) {
  const m = mapas[variante];
  const idClip = `fazenda${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const c = curvas.cartao;
  const vao = variante === "mini" ? 3 : 5;

  return (
    <svg
      role="img"
      aria-label={titulo}
      viewBox={`${-m.margem} ${-m.margem} ${m.largura + 2 * m.margem} ${m.altura + 2 * m.margem}`}
      className={cn("block h-auto w-full", className)}
    >
      <defs>
        <clipPath id={idClip}>
          <path d={m.contorno} />
        </clipPath>
      </defs>

      <g transform={m.angulo ? `rotate(${m.angulo} ${m.largura / 2} ${m.altura / 2})` : undefined}>
        <g clipPath={`url(#${idClip})`}>
          {m.talhoes.map((t) => (
            <path
              key={t.id}
              d={t.d}
              className={cn(uniforme ? "fill-talhao-3" : preenchimento[t.nivel], corDoVao)}
              strokeWidth={vao}
              strokeLinejoin="round"
            />
          ))}

          {/* curvas de nível por cima, bem leves, para lembrar o relevo */}
          <use
            href={`#${idCurvas("cartao")}`}
            transform={`scale(${m.largura / c.largura} ${m.altura / c.altura})`}
            className="stroke-fundo"
            strokeOpacity={0.3}
          />

          {destaque !== undefined && (
            <path
              d={m.talhoes[destaque].d}
              fill="none"
              className="stroke-texto"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

        </g>

        {contorno && (
          <path d={m.contorno} fill="none" className="stroke-texto-2" strokeOpacity={0.45} strokeWidth={1} />
        )}

        {numeros &&
          m.talhoes.filter((t) => t.rotulavel).map((t) => (
            <text
              key={t.id}
              x={t.centro[0]}
              y={t.centro[1]}
              textAnchor="middle"
              dominantBaseline="central"
              className={cn("font-dado text-[11px]", t.nivel >= 4 ? "fill-fundo" : "fill-texto")}
              fillOpacity={t.nivel >= 4 ? 0.85 : 0.6}
            >
              {t.numero}
            </text>
          ))}

      </g>
    </svg>
  );
}

export function posicaoDoTalhao(variante: VarianteMapa, id: number) {
  const m = mapas[variante];
  return { ...posicaoNaTela(m, m.talhoes[id].centro), numero: m.talhoes[id].numero };
}

export function LegendaProducao({ className }: { className?: string }) {
  const niveis: Nivel[] = [1, 2, 3, 4, 5];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="t-rotulo text-texto-2">Baixa</span>
      <ul
        className="flex overflow-hidden rounded-[3px] border border-linha"
        aria-label="Faixas de produção, da mais baixa para a mais alta"
      >
        {niveis.map((n) => (
          <li key={n} className="flex">
            <span
              className={cn("block h-3 w-8 sm:w-10", {
                "bg-talhao-1": n === 1,
                "bg-talhao-2": n === 2,
                "bg-talhao-3": n === 3,
                "bg-talhao-4": n === 4,
                "bg-talhao-5": n === 5,
              })}
            />
            <span className="sr-only">Faixa {n} de 5</span>
          </li>
        ))}
      </ul>
      <span className="t-rotulo text-texto-2">Alta</span>
    </div>
  );
}
