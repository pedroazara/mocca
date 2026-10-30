import { useId } from "react";
import { montarPilha } from "@/lib/camadas";
import { cn } from "@/lib/utils";
import { idCurvas } from "./curvas-de-nivel";
import { mapas, preenchimento } from "./grade-talhoes";

// Pilha de camadas de agricultura de precisão: a mesma lavoura (o mapa "mini")
// em placas deitadas, uma sobre a outra. Embaixo, os mapas que o produtor já
// costuma ter (solo e adubação, irrigação, satélite ou drone), em tons neutros.
// No alto, separada das outras, a colheita: vazia sem monitoramento (o resultado
// que ninguém sabe), ou talhão por talhão com o MoCCa. Um fio pontilhado liga o mesmo talhão (o 08,
// da faixa mais baixa; se a semente do mapa mudar, conferir o nível dele) em
// todas as camadas. Geometria em lib/camadas.ts.

const p = montarPilha(mapas.mini);
const [mx, my] = p.destaque.centro;
// vigor (NDVI), do mais fraco ao mais forte: as cores dos mapas de satélite de verdade
const VIGOR = [
  "fill-ndvi-1",
  "fill-ndvi-2",
  "fill-ndvi-3",
  "fill-ndvi-4",
  "fill-ndvi-5",
];
// fileiras de café em unidades do mapa: um pé a cada `passo`, uma rua a cada `rua`
const PE = { passo: 5.4, rua: 8, raio: 2.5 };

export function PilhaCamadas({
  colheita,
  titulo,
  className,
}: {
  colheita: "vazia" | "talhao";
  titulo: string;
  className?: string;
}) {
  const id = `pilha${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const porTalhao = colheita === "talhao";

  // placa: espessura, topo, conteúdo recortado pelo contorno e a borda
  const placa = (
    i: number,
    conteudo: React.ReactNode,
    topo: string,
    lateral: string,
  ) => (
    <g key={i} transform={`translate(0 ${p.deslocamentos[i]})`}>
      {Array.from({ length: p.espessura }, (_, j) => (
        <use
          key={j}
          href={`#${id}-k`}
          y={p.espessura - j}
          className={lateral}
        />
      ))}
      <use href={`#${id}-k`} className={topo} />
      <g clipPath={`url(#${id}-c)`}>{conteudo}</g>
      {/* a camada do MoCCa ganha a borda na cor da marca */}
      <use
        href={`#${id}-k`}
        fill="none"
        className={i === 0 ? "stroke-caramelo" : "stroke-texto-2"}
        strokeOpacity={i === 0 ? 1 : 0.35}
        strokeWidth={i === 0 ? 2 : 1}
        vectorEffect="non-scaling-stroke"
      />
      {/* fio até a placa de cima (a placa de cima, desenhada depois, cobre o que fica atrás dela) */}
      {i > 0 && (
        <path
          d={`M${mx} ${my}V${my - (p.deslocamentos[i] - p.deslocamentos[i - 1])}`}
          className="stroke-texto"
          strokeOpacity={0.6}
          strokeWidth={1}
          strokeDasharray="2 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <circle
        cx={mx}
        cy={my}
        r={3}
        className="fill-fundo stroke-texto"
        strokeWidth={1.3}
      />
    </g>
  );

  const curvasLeves = (opacidade: number, classe = "stroke-texto-2") => (
    <use
      href={`#${idCurvas("cartao")}`}
      transform={p.matrizCurvas}
      className={classe}
      strokeOpacity={opacidade}
    />
  );

  return (
    <div className={cn("relative w-full", className)}>
      <svg
        role="img"
        aria-label={titulo}
        viewBox={`0 0 ${p.largura} ${p.altura}`}
        className="block h-auto w-full"
      >
        <defs>
          <path id={`${id}-k`} d={p.contorno} />
          <clipPath id={`${id}-c`}>
            <path d={p.contorno} />
          </clipPath>
          {/* pés de café em fileiras (no plano do mapa, como as linhas de gotejo): só eles mostram o vigor */}
          <pattern
            id={`${id}-pes`}
            width={PE.passo}
            height={PE.rua}
            patternUnits="userSpaceOnUse"
            patternTransform={p.matrizMapa}
          >
            <circle cx={PE.passo / 2} cy={PE.rua / 2} r={PE.raio} fill="#fff" />
          </pattern>
          <mask
            id={`${id}-m`}
            maskUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={p.largura}
            height={p.altura}
          >
            <rect
              width={p.largura}
              height={p.altura}
              fill={`url(#${id}-pes)`}
            />
          </mask>
        </defs>

        {/* de baixo para cima: solo e adubação, irrigação, satélite ou drone, colheita */}
        {placa(
          3,
          <>
            {p.zonas.map((d, i) => (
              <path
                key={i}
                d={d}
                className="fill-texto-2"
                fillOpacity={i ? 0.2 : 0.1}
              />
            ))}
            {curvasLeves(0.14)}
            {p.amostras.map(([x, y]) => (
              <circle
                key={`${x}-${y}`}
                cx={x}
                cy={y}
                r={1.9}
                className="fill-texto-2"
                fillOpacity={0.8}
              />
            ))}
          </>,
          "fill-camada",
          "fill-linha",
        )}
        {placa(
          2,
          <>
            {/* gotejo: mangueiras finas nas ruas e a adutora, em azul */}
            <path
              d={p.irrigacao}
              fill="none"
              className="stroke-agua"
              strokeOpacity={0.75}
              strokeWidth={1.1}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={p.adutora}
              fill="none"
              className="stroke-agua"
              strokeWidth={2.6}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </>,
          "fill-camada",
          "fill-linha",
        )}
        {placa(
          1,
          <>
            <g mask={`url(#${id}-m)`}>
              {p.satelite.map((d, i) => (
                <path key={i} d={d} className={VIGOR[i]} />
              ))}
            </g>
            <path
              d={p.divisas}
              fill="none"
              className="stroke-fundo"
              strokeOpacity={0.55}
              strokeWidth={1}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </>,
          "fill-camada",
          "fill-linha",
        )}
        {porTalhao ? (
          placa(
            0,
            <>
              {p.talhoes.map((t, i) => (
                <path
                  key={i}
                  d={t.d}
                  className={cn(preenchimento[t.nivel], "stroke-fundo")}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              ))}
              {curvasLeves(0.3, "stroke-fundo")}
              <path
                d={p.destaque.d}
                fill="none"
                className="stroke-texto"
                strokeWidth={1.5}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>,
            "fill-fundo",
            "fill-espresso",
          )
        ) : (
          // sem monitoramento: a camada do resultado fica vazia, e o fio termina numa pergunta
          <g>
            <use
              href={`#${id}-k`}
              fill="none"
              className="stroke-texto-2"
              strokeOpacity={0.7}
              strokeWidth={1.2}
              strokeDasharray="5 5"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={mx}
              cy={my}
              r={9}
              className="fill-fundo stroke-texto-2"
              strokeWidth={1.2}
              strokeDasharray="3 2.5"
            />
            <text
              x={mx}
              y={my}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-texto-2 font-dado text-[11px] font-semibold"
            >
              ?
            </text>
          </g>
        )}
      </svg>
      {/* etiqueta presa na camada de cima: é o MoCCa que traz essa camada */}
      {porTalhao && (
        <span
          aria-hidden
          style={{ top: `${p.topoPlaca}%` }}
          className="absolute right-0 -translate-y-1/2 rounded-full bg-caramelo px-3 py-1 text-[0.75rem] font-semibold whitespace-nowrap text-botao-primario-texto shadow-cartao sm:text-[0.8125rem]"
        >
          Camada do MoCCa
        </span>
      )}
    </div>
  );
}

const CAMADAS = [
  "Colheita",
  "Satélite ou drone",
  "Irrigação",
  "Solo e adubação",
];

// Nomes das camadas, alinhados ao centro de cada placa (em % da altura da pilha).
export function RotulosCamadas({ className }: { className?: string }) {
  return (
    <ol aria-hidden className={cn("relative", className)}>
      {CAMADAS.map((nome, i) => (
        <li
          key={nome}
          style={{ top: `${p.centros[i]}%` }}
          className={cn(
            "absolute inset-x-0 flex -translate-y-1/2 items-center gap-1 text-[0.8125rem] leading-tight md:justify-center md:text-center md:text-[0.875rem]",
            i === 0 ? "font-semibold text-texto" : "text-texto-2",
          )}
        >
          {nome}
        </li>
      ))}
    </ol>
  );
}
