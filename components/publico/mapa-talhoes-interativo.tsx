"use client";

import { useEffect, useRef, useState } from "react";
import type { InfoTalhao } from "@/lib/talhao-info";
import { posicaoNaTela, type Mapa } from "@/lib/talhoes";
import { cn } from "@/lib/utils";

// Mapa de talhões interativo ("O que você passa a ver"). O desenho é o
// GradeTalhoes (servidor), passado como filho; por cima vai uma camada
// transparente que reage ao mouse, ao toque e ao teclado. O talhão escolhido
// ganha contorno e um marcador, os outros escurecem, e o cartão desliza até ele
// com as sacas colhidas, a maturação e o tamanho do grão, em números que correm.
// Os valores são ilustrativos (lib/talhao-info.ts) e o cartão diz isso.

const PENEIRA = { min: 13, max: 19 };
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const mudar = () => setReduzido(m.matches);
    mudar();
    m.addEventListener("change", mudar);
    return () => m.removeEventListener("change", mudar);
  }, []);
  return reduzido;
}

// número que corre do valor anterior até o novo (desaceleração no fim)
function Numero({ valor, casas = 0, reduzido }: { valor: number; casas?: number; reduzido: boolean }) {
  const [mostrado, setMostrado] = useState(valor);
  const atual = useRef(valor);
  useEffect(() => {
    if (reduzido) {
      atual.current = valor;
      setMostrado(valor);
      return;
    }
    const de = atual.current;
    const inicio = performance.now();
    const DURACAO = 750;
    let quadro = 0;
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - inicio) / DURACAO);
      const e = 1 - Math.pow(1 - p, 3);
      atual.current = de + (valor - de) * e;
      setMostrado(atual.current);
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, reduzido]);
  return <>{mostrado.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}</>;
}

const COR_NIVEL = ["", "bg-talhao-1", "bg-talhao-2", "bg-talhao-3", "bg-talhao-4", "bg-talhao-5"];

function Cartao({ info, reduzido, className }: { info: InfoTalhao; reduzido: boolean; className?: string }) {
  const transicao = { transitionTimingFunction: EASE };
  const pos = ((info.peneira - PENEIRA.min) / (PENEIRA.max - PENEIRA.min)) * 100;
  return (
    <div className={cn("w-[15.5rem] rounded-m border border-linha bg-superficie/95 p-3.5 shadow-flutuante backdrop-blur-[6px]", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="t-dado text-[0.875rem] font-semibold text-texto">Talhão {info.numero}</p>
        <span className="t-pequeno flex items-center gap-1.5 text-texto-2">
          <span className={cn("size-2.5 rounded-[3px] border border-linha transition-colors duration-500", COR_NIVEL[info.nivel])} />
          faixa {info.nivel} de 5
        </span>
      </div>

      <div className="mt-3">
        <p className="t-rotulo text-[0.6875rem] text-texto-2">Sacas colhidas</p>
        <p className="mt-1 font-titulo text-[1.75rem] leading-none font-semibold text-texto tabular-nums">
          <Numero valor={info.sacas} reduzido={reduzido} />
        </p>
        <p className="t-pequeno mt-1.5 text-texto-2 tabular-nums">
          <Numero valor={info.sacasHa} reduzido={reduzido} /> sacas/ha · <Numero valor={info.areaHa} casas={1} reduzido={reduzido} /> ha
        </p>
      </div>

      <div className="mt-3.5">
        <p className="t-rotulo text-[0.6875rem] text-texto-2">Maturação</p>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-superficie-2" aria-hidden>
          {(
            [
              ["bg-fruto-verde", info.verde],
              ["bg-fruto-cereja", info.cereja],
              ["bg-fruto-passa", info.passa],
            ] as const
          ).map(([cor, v]) => (
            <span key={cor} className={cn("h-full transition-[width] duration-700", cor)} style={{ width: `${v}%`, ...transicao }} />
          ))}
        </div>
        <div className="t-pequeno mt-1.5 flex justify-between text-texto-2 tabular-nums">
          <span>
            verde <span className="text-texto"><Numero valor={info.verde} reduzido={reduzido} />%</span>
          </span>
          <span>
            cereja <span className="text-texto"><Numero valor={info.cereja} reduzido={reduzido} />%</span>
          </span>
          <span>
            passa <span className="text-texto"><Numero valor={info.passa} reduzido={reduzido} />%</span>
          </span>
        </div>
      </div>

      <div className="mt-3.5">
        <div className="flex items-baseline justify-between">
          <p className="t-rotulo text-[0.6875rem] text-texto-2">Tamanho do grão</p>
          <p className="t-dado text-[0.8125rem] text-texto tabular-nums">
            peneira <Numero valor={info.peneira} casas={1} reduzido={reduzido} />
          </p>
        </div>
        <div className="relative mt-2.5 h-1.5 rounded-full bg-superficie-2" aria-hidden>
          {Array.from({ length: PENEIRA.max - PENEIRA.min - 1 }, (_, i) => (
            <span
              key={i}
              className="absolute top-0 h-full w-px bg-linha"
              style={{ left: `${((i + 1) / (PENEIRA.max - PENEIRA.min)) * 100}%` }}
            />
          ))}
          <span
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-superficie bg-caramelo shadow-cartao transition-[left] duration-700"
            style={{ left: `${pos}%`, ...transicao }}
          />
        </div>
        <div className="t-pequeno mt-1 flex justify-between text-texto-2" aria-hidden>
          <span>{PENEIRA.min}</span>
          <span>{PENEIRA.max}</span>
        </div>
      </div>

      <p className="t-pequeno mt-3 border-t border-linha pt-2 text-[0.75rem] text-texto-2">Valores ilustrativos</p>
    </div>
  );
}

export function MapaTalhoesInterativo({
  mapa,
  infos,
  inicial,
  children,
}: {
  mapa: Pick<Mapa, "largura" | "altura" | "margem" | "angulo" | "contorno" | "talhoes">;
  infos: InfoTalhao[];
  inicial: number;
  children: React.ReactNode;
}) {
  const [ativo, setAtivo] = useState(inicial);
  const [explorando, setExplorando] = useState(false);
  const [aviso, setAviso] = useState("");
  const reduzido = useMovimentoReduzido();
  const m = mapa as Mapa;
  const t = m.talhoes[ativo];
  const info = infos[ativo];
  const { esquerda, topo } = posicaoNaTela(m, t.centro);
  const id = "mapa-talhoes";

  // o cartão fica acima do talhão; perto do topo, desce; perto das bordas, encosta para dentro
  const abaixo = topo < 42;
  const dx = esquerda < 28 ? "-14%" : esquerda > 72 ? "-86%" : "-50%";
  const dy = abaixo ? "26px" : "calc(-100% - 26px)";
  const deslizar = { transitionTimingFunction: EASE };

  const escolher = (i: number, porTeclado = false) => {
    setAtivo(i);
    if (porTeclado) {
      const x = infos[i];
      setAviso(
        `Talhão ${x.numero}: ${x.sacas} sacas, ${x.sacasHa} sacas por hectare; maturação ${x.cereja}% cereja, ${x.verde}% verde, ${x.passa}% passa; peneira ${x.peneira.toLocaleString("pt-BR")}. Valores ilustrativos.`,
      );
    }
  };

  const teclado = (e: React.KeyboardEvent) => {
    const n = m.talhoes.length;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") escolher((ativo + 1) % n, true);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") escolher((ativo - 1 + n) % n, true);
    else return;
    e.preventDefault();
  };

  const vb = `${-m.margem} ${-m.margem} ${m.largura + 2 * m.margem} ${m.altura + 2 * m.margem}`;
  const girar = m.angulo ? `rotate(${m.angulo} ${m.largura / 2} ${m.altura / 2})` : undefined;

  return (
    <div>
      <div
        tabIndex={0}
        role="group"
        aria-label="Mapa interativo dos talhões, com valores ilustrativos. Use as setas para trocar de talhão."
        onKeyDown={teclado}
        onPointerEnter={() => setExplorando(true)}
        onPointerLeave={() => setExplorando(false)}
        onFocus={() => setExplorando(true)}
        onBlur={() => setExplorando(false)}
        className="relative rounded-g outline-none focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-4 focus-visible:ring-offset-fundo"
      >
        {children}

        <svg viewBox={vb} className="absolute inset-0 block h-full w-full" aria-hidden>
          <defs>
            <clipPath id={`${id}-c`}>
              <path d={m.contorno} />
            </clipPath>
          </defs>
          <g transform={girar}>
            <g clipPath={`url(#${id}-c)`}>
              {/* os outros talhões escurecem enquanto a pessoa explora o mapa */}
              {m.talhoes.map((tl) => (
                <path
                  key={tl.id}
                  d={tl.d}
                  className="fill-fundo transition-[fill-opacity] duration-300"
                  fillOpacity={explorando && tl.id !== ativo ? 0.42 : 0}
                  onPointerEnter={() => escolher(tl.id)}
                  onClick={() => escolher(tl.id)}
                  style={{ cursor: "pointer" }}
                />
              ))}
              {/* contorno do talhão escolhido, desenhado de novo a cada troca */}
              <g key={ativo} className="pointer-events-none">
                <path d={t.d} fill="none" className="stroke-fundo" strokeWidth={6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <path
                  d={t.d}
                  fill="none"
                  pathLength={1}
                  className="contorno-entra stroke-texto"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            </g>
            {/* marcador no centro do talhão: anel e ponto, deslizando de um para outro */}
            <g
              className="pointer-events-none transition-transform duration-500"
              style={{ transform: `translate(${t.centro[0]}px, ${t.centro[1]}px)`, ...deslizar }}
            >
              <circle r={13} className="fill-none stroke-texto" strokeOpacity={0.5} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              <circle r={5.5} className="fill-texto stroke-superficie" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
            </g>
          </g>
        </svg>

        {/* cartão flutuante (do tablet em diante) */}
        <div
          className="pointer-events-none absolute hidden transition-[left,top] duration-500 md:block"
          style={{ left: `${esquerda}%`, top: `${topo}%`, ...deslizar }}
        >
          <span
            className={cn(
              "absolute left-0 w-px bg-texto/50 transition-[top,height] duration-500",
              abaixo ? "top-[14px] h-[12px]" : "-top-[26px] h-[12px]",
            )}
          />
          <div className="absolute top-0 left-0 transition-transform duration-500" style={{ transform: `translate(${dx}, ${dy})`, ...deslizar }}>
            <Cartao info={info} reduzido={reduzido} />
          </div>
        </div>
      </div>

      {/* no celular, o cartão fica embaixo do mapa (toque num talhão para trocar) */}
      <Cartao info={info} reduzido={reduzido} className="mx-auto mt-5 w-full max-w-[22rem] md:hidden" />
      <p aria-live="polite" className="sr-only">
        {aviso}
      </p>
    </div>
  );
}
