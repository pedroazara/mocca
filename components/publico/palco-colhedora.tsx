"use client";

import { useId, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RotuloDaEtapa, useEtapaDoPainel } from "./rolagem-painel";
import { lugarNoCaminho, medirCaminho, type CaminhoDaColhedora } from "./vinheta-localiza";
import { Lavoura, NIVEL, type TalhaoDaVinheta } from "./vinheta-mapeia";

// O palco do painel do Início, com duas camadas no mesmo quadro: a cena da
// colhedora (vem pronta do servidor, em `cena`) e, por cima, o mapa da fazenda.
// Quando a rolagem chega na etapa 2, a câmera se afasta: a cena encolhe até virar
// o ponto onde a colhedora está no mapa, e o mapa chega de perto até caber
// inteiro. Dali em diante a colhedora anda pela lavoura conforme a página rola, e
// os talhões ganham a cor da produção atrás dela. É a mesma lavoura das vinhetas
// "Localiza" e "Mapeia". Quando o painel não gruda (ver rolagem-painel.tsx), o
// mapa pronto aparece embaixo da cena.

// a janela do mapa: a lavoura com uma margem em volta, para a estrada e a sede
const JANELA = { x: -64, y: -40, l: 368, a: 222 };

type Props = {
  cena: ReactNode;
  curvas?: ReactNode; // curvas de nível no fundo do mapa
  largura: number;
  altura: number;
  contorno: string;
  talhoes: TalhaoDaVinheta[];
  caminho: CaminhoDaColhedora;
  fundo?: ReactNode; // curvas de nível por cima dos talhões
};

function MapaDaFazenda({
  altura,
  contorno,
  talhoes,
  fundo,
  pintado,
  aqui,
  pronto,
  className,
}: Pick<Props, "altura" | "contorno" | "talhoes" | "fundo"> & {
  pintado: (number[] | null)[];
  aqui: [number, number];
  pronto: boolean;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      viewBox={`${JANELA.x} ${JANELA.y} ${JANELA.l} ${JANELA.a}`}
      role="img"
      aria-label="Mapa ilustrativo da fazenda, visto de cima: a lavoura dividida em talhões, cada um na cor da faixa de produção, de baixa a alta."
      className={cn("block", className)}
    >
      <defs>
        {pintado.map(
          (x, f) =>
            x && (
              <clipPath key={f} id={`${id}-faixa${f}`}>
                <rect x={x[0]} y={-20} width={x[1] - x[0]} height={altura + 40} />
              </clipPath>
            ),
        )}
      </defs>

      {/* a estrada da fazenda e a sede */}
      <path
        d={`M${JANELA.x} ${altura + 4}C-20 ${altura + 2} -22 ${altura + 22} 30 ${altura + 20}S190 ${altura + 30} ${JANELA.x + JANELA.l} ${altura + 14}`}
        fill="none"
        className="stroke-linha"
        strokeWidth={5}
      />
      <path d={`M-30 ${altura + 6}V${altura - 26}`} fill="none" className="stroke-linha" strokeWidth={3.4} />
      <g className="fill-texto-2" fillOpacity={0.55}>
        <rect x={-42} y={altura - 46} width={16} height={11} rx={1} />
        <rect x={-23} y={altura - 40} width={9} height={9} rx={1} />
        <rect x={-46} y={altura - 31} width={10} height={7} rx={1} />
      </g>

      <Lavoura contorno={contorno} talhoes={talhoes} cor={talhoes.map(() => 0)}>
        {talhoes.map(
          (tl, k) =>
            pintado[tl.faixa] && (
              <path
                key={k}
                d={tl.d}
                clipPath={`url(#${id}-faixa${tl.faixa})`}
                className={cn(NIVEL[tl.nivel], "stroke-superficie")}
                strokeWidth={3}
                strokeLinejoin="round"
              />
            ),
        )}
        {fundo}
      </Lavoura>

      {/* a colhedora: anel e ponto no lugar onde ela está; some com o mapa pronto */}
      <g className="transition-opacity duration-300 ease-out" opacity={pronto ? 0 : 1}>
        <circle
          cx={aqui[0]}
          cy={aqui[1]}
          r={8}
          fill="none"
          className="stroke-caramelo"
          strokeOpacity={0.55}
          strokeWidth={1.2}
        />
        <circle cx={aqui[0]} cy={aqui[1]} r={3.8} className="fill-caramelo stroke-superficie" strokeWidth={1.5} />
      </g>

      {/* legenda, encostada à direita */}
      <g className="font-dado text-[7px]" transform={`translate(${JANELA.x + JANELA.l - 8} ${JANELA.y + 13})`}>
        <text x={-72} y={6} textAnchor="end" className="fill-texto-2">
          Baixa
        </text>
        {[1, 2, 3, 4, 5].map((n) => (
          <rect key={n} x={-68 + (n - 1) * 10} y={0} width={10} height={7} className={NIVEL[n]} />
        ))}
        <rect x={-68} y={0} width={50} height={7} rx={1.2} fill="none" className="stroke-linha" strokeWidth={0.7} />
        <text x={0} y={6} textAnchor="end" className="fill-texto-2">
          Alta
        </text>
      </g>
    </svg>
  );
}

export function PalcoDaColhedora({ cena, curvas, caminho, ...lavoura }: Props) {
  const { etapa, avanco, solto } = useEtapaDoPainel();
  const quadro = useRef<HTMLDivElement>(null);
  const medida = useMemo(() => medirCaminho(caminho), [caminho]);
  const { aqui, pintado } = lugarNoCaminho(caminho, medida, avanco * medida.total);
  const inteiro = lugarNoCaminho(caminho, medida, medida.total);

  // O ponto do quadro onde a colhedora está no mapa: é para lá que a cena encolhe
  // e é de lá que o mapa chega. Medido quando a câmera começa a se afastar.
  const partida = caminho[0];
  const antes = useRef(0);
  useLayoutEffect(() => {
    const el = quadro.current;
    if (el && etapa >= 2 && antes.current < 2) {
      const [l, a] = [el.clientWidth, el.clientHeight];
      const k = Math.min(l / JANELA.l, a / JANELA.a);
      el.style.setProperty("--ox", `${((l - JANELA.l * k) / 2 + (partida[0] - JANELA.x) * k).toFixed(1)}px`);
      el.style.setProperty("--oy", `${((a - JANELA.a * k) / 2 + (partida[1] - JANELA.y) * k).toFixed(1)}px`);
    }
    antes.current = etapa;
  }, [etapa, partida]);

  return (
    <>
      {/* o selo da etapa fica embaixo do quadro; em telas largas, por cima do chão da cena */}
      <div className="relative">
        <div
          ref={quadro}
          className="quadro-painel relative overflow-hidden rounded-g border border-linha bg-superficie"
        >
          <div className="camada-cena absolute inset-0">{cena}</div>
          <div className="camada-fazenda absolute inset-0 bg-superficie" aria-hidden={etapa < 2}>
            {curvas}
            <MapaDaFazenda
              {...lavoura}
              pintado={pintado}
              aqui={aqui}
              pronto={etapa === 3}
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
        <RotuloDaEtapa className="mx-auto mt-3 w-fit lg:absolute lg:bottom-3 lg:left-1/2 lg:mt-0 lg:-translate-x-1/2" />
      </div>

      {/* quando o painel não gruda: o mapa pronto, embaixo da cena */}
      {solto && (
        <div className="relative mt-3 overflow-hidden rounded-g border border-linha bg-superficie">
          {curvas}
          <MapaDaFazenda
            {...lavoura}
            pintado={inteiro.pintado}
            aqui={inteiro.aqui}
            pronto
            className="relative mx-auto h-auto w-full max-w-[760px]"
          />
        </div>
      )}
    </>
  );
}
