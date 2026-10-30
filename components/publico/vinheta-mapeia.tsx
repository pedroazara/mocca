"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useRelogioDaVinheta } from "./relogio-vinheta";

// Vinheta "Mapeia" do passo a passo: o mapa de produção pronto, com a legenda de
// Baixa a Alta. Uma faixa de produção por vez acende (os talhões dela ficam com a
// cor cheia e contornados; os outros, apagados), mostrando onde a lavoura rende
// mais e onde rende menos. Depois o mapa volta inteiro. Os talhões e o fundo
// (curvas de nível) vêm do servidor. Com movimento reduzido, fica no mapa inteiro.
// Aqui também ficam a lavoura e as funções que a vinheta "Localiza" usa.

export type TalhaoDaVinheta = { d: string; nivel: number; faixa: number }; // faixa: a fileira de talhões, de cima para baixo

export const limitar = (v: number) => Math.min(1, Math.max(0, v));
export const suave = (u: number) => u * u * (3 - 2 * u);
export const NIVEL = ["", "fill-talhao-1", "fill-talhao-2", "fill-talhao-3", "fill-talhao-4", "fill-talhao-5"];

// a lavoura fica no mesmo lugar nas duas vinhetas, embaixo da linha do rótulo
export const ESCALA = 0.76;
export const [DX, DY] = [28.8, 34];

// A lavoura do mapa pequeno: talhões sem cor por baixo e, por cima, a cor de cada
// um com a opacidade de `cor`. Tudo o que vem em `fundo` e `children` fica
// recortado pelo contorno da lavoura.
export function Lavoura({
  contorno,
  talhoes,
  cor,
  fundo,
  children,
}: {
  contorno: string;
  talhoes: TalhaoDaVinheta[];
  cor: number[];
  fundo?: ReactNode;
  children?: ReactNode;
}) {
  const idClip = `lavoura${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <>
      <defs>
        <clipPath id={idClip}>
          <path d={contorno} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${idClip})`}>
        {talhoes.map((tl, i) => (
          <path key={i} d={tl.d} className="fill-superficie-2 stroke-superficie" strokeWidth={3} strokeLinejoin="round" />
        ))}
        {talhoes.map(
          (tl, i) =>
            cor[i] > 0 && (
              <path
                key={i}
                d={tl.d}
                className={cn(NIVEL[tl.nivel], "stroke-superficie")}
                opacity={cor[i]}
                strokeWidth={3}
                strokeLinejoin="round"
              />
            ),
        )}
        {fundo}
        {children}
      </g>
    </>
  );
}

// tempo (segundos)
const COMECA = 0.8; // a primeira faixa acende
const FAIXA = 1.5; // cada faixa fica acesa isto
const CICLO = COMECA + 5 * FAIXA + 2.2;
const T_PARADO = 0.3; // o mapa inteiro, nenhuma faixa acesa
const APAGADO = 0.22; // a cor dos talhões fora da faixa acesa

const sobe = (u: number) => suave(limitar(u / 0.35));
// quanto a faixa `n` (1 a 5) está acesa: uma apaga enquanto a seguinte acende
const acesa = (n: number, t: number) => {
  const ini = COMECA + (n - 1) * FAIXA;
  return sobe(t - ini + 0.175) * (1 - sobe(t - ini - FAIXA + 0.175));
};
// quanto o mapa está no modo de destaque, com as outras faixas apagadas
const destaque = (t: number) => sobe(t - COMECA + 0.35) * (1 - sobe(t - COMECA - 5 * FAIXA));

export function VinhetaMapeiaAnimada({
  contorno,
  talhoes,
  fundo,
  className,
}: {
  contorno: string;
  talhoes: TalhaoDaVinheta[];
  fundo?: ReactNode;
  className?: string;
}) {
  const [tela, t] = useRelogioDaVinheta<SVGSVGElement>(CICLO, T_PARADO);
  const modo = destaque(t);
  const luz = [0, 1, 2, 3, 4, 5].map((n) => modo * acesa(n, t)); // quanto cada faixa está realçada

  return (
    <svg
      ref={tela}
      role="img"
      aria-label="Mapa de produção ilustrativo, com os talhões em cinco faixas, de baixa a alta"
      viewBox="0 0 240 150"
      className={cn("h-auto w-full", className)}
    >
      <g transform={`translate(${DX} ${DY}) scale(${ESCALA})`}>
        <Lavoura
          contorno={contorno}
          talhoes={talhoes}
          cor={talhoes.map((tl) => 1 - (1 - APAGADO) * modo * (1 - acesa(tl.nivel, t)))}
          fundo={fundo}
        >
          {talhoes.map(
            (tl, i) =>
              luz[tl.nivel] > 0.01 && (
                <path
                  key={i}
                  d={tl.d}
                  fill="none"
                  className="stroke-texto"
                  strokeOpacity={luz[tl.nivel]}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              ),
          )}
        </Lavoura>
      </g>

      {/* legenda: a faixa acesa ganha um contorno */}
      <g className="font-dado text-[7px]">
        <text x={146} y={13} textAnchor="end" className="fill-texto-2">
          Baixa
        </text>
        {[1, 2, 3, 4, 5].map((n) => (
          <rect key={n} x={150 + (n - 1) * 12} y={6.5} width={12} height={8} className={NIVEL[n]} />
        ))}
        <rect x={150} y={6.5} width={60} height={8} rx={1.5} fill="none" className="stroke-linha" strokeWidth={0.8} />
        {[1, 2, 3, 4, 5].map(
          (n) =>
            luz[n] > 0.01 && (
              <rect
                key={n}
                x={150 + (n - 1) * 12}
                y={5.5}
                width={12}
                height={10}
                rx={1}
                fill="none"
                className="stroke-texto"
                strokeOpacity={luz[n]}
                strokeWidth={1.2}
              />
            ),
        )}
        <text x={214} y={13} className="fill-texto-2">
          Alta
        </text>
      </g>

      <text x={20} y={13} className="fill-texto-2 font-dado text-[9px] tracking-[0.08em]">
        PRODUÇÃO
      </text>
    </svg>
  );
}
