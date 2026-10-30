"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { InfoTalhao } from "@/lib/talhao-info";
import { posicaoNaTela, type Mapa } from "@/lib/talhoes";
import { cn } from "@/lib/utils";

// Mapa de talhões interativo ("O que você passa a ver"). O desenho é o
// GradeTalhoes (servidor), passado como filho; por cima vai uma camada
// transparente que reage ao mouse, ao toque e ao teclado. O talhão escolhido
// ganha contorno e um marcador, os outros escurecem, e o cartão desliza para o
// lado dele com a estimativa de sacas, a maturação e o tamanho do fruto, em
// números que correm. Os valores são ilustrativos (lib/talhao-info.ts).
// Para leitor de tela, o mapa é uma lista de talhões (listbox) navegável pelas setas.

const DIAMETRO = { min: 10, max: 16 }; // mm
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const VAO = 14; // entre o talhão e o cartão, em px
const SOBRA = 32; // quanto o cartão pode passar da borda do mapa, para o lado (cai no vão da grade)

function useConsulta(consulta: string, inicial: boolean) {
  const [vale, setVale] = useState(inicial);
  useEffect(() => {
    const m = matchMedia(consulta);
    const mudar = () => setVale(m.matches);
    mudar();
    m.addEventListener("change", mudar);
    return () => m.removeEventListener("change", mudar);
  }, [consulta]);
  return vale;
}

// número que corre do valor anterior até o novo (desaceleração no fim)
function Numero({ valor, casas = 0, animar }: { valor: number; casas?: number; animar: boolean }) {
  const [mostrado, setMostrado] = useState(valor);
  const atual = useRef(valor);
  useEffect(() => {
    if (!animar) {
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
      atual.current = de + (valor - de) * (1 - Math.pow(1 - p, 3));
      setMostrado(atual.current);
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, animar]);
  return <>{mostrado.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}</>;
}

const COR_NIVEL = ["", "bg-talhao-1", "bg-talhao-2", "bg-talhao-3", "bg-talhao-4", "bg-talhao-5"];
const umaCasa = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// o que o leitor de tela anuncia: o mesmo que o cartão mostra, na mesma ordem
const resumo = (x: InfoTalhao) =>
  `Talhão ${x.numero}: ${x.sacasHa} sacas por hectare, faixa ${x.nivel} de 5; ` +
  `${x.sacas} sacas estimadas em ${umaCasa(x.areaHa)} hectares; ` +
  `maturação ${x.verde}% verde, ${x.cereja}% cereja, ${x.boia}% boia; ` +
  `fruto com ${umaCasa(x.diametro)} milímetros. Valores ilustrativos.`;

function Cartao({ info, animar, className }: { info: InfoTalhao; animar: boolean; className?: string }) {
  const suave = { transitionTimingFunction: EASE };
  const pos = ((info.diametro - DIAMETRO.min) / (DIAMETRO.max - DIAMETRO.min)) * 100;
  return (
    <div
      aria-hidden
      className={cn("w-[14.5rem] rounded-m border border-linha bg-superficie/95 p-3 shadow-flutuante backdrop-blur-[6px]", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="t-dado text-[0.875rem] font-semibold text-texto">Talhão {info.numero}</p>
        {/* a cor do talhão é a da produtividade: fica junto das sacas por hectare */}
        <span className="t-pequeno flex items-center gap-1.5 text-texto-2 tabular-nums">
          <span className={cn("size-2.5 rounded-[3px] border border-linha transition-colors duration-500", COR_NIVEL[info.nivel])} />
          <Numero valor={info.sacasHa} animar={animar} /> sacas/ha
        </span>
      </div>

      <div className="mt-2.5">
        <p className="t-rotulo text-[0.6875rem] text-texto-2">Sacas estimadas</p>
        <p className="mt-1 flex items-baseline gap-2 tabular-nums">
          <span className="font-titulo text-[1.625rem] leading-none font-semibold text-texto">
            <Numero valor={info.sacas} animar={animar} />
          </span>
          <span className="t-pequeno text-texto-2">
            em <Numero valor={info.areaHa} casas={1} animar={animar} /> ha
          </span>
        </p>
      </div>

      <div className="mt-3">
        <p className="t-rotulo text-[0.6875rem] text-texto-2">Maturação</p>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-superficie-2">
          {(
            [
              ["bg-fruto-verde", info.verde],
              ["bg-fruto-cereja", info.cereja],
              ["bg-fruto-passa", info.boia],
            ] as const
          ).map(([cor, v]) => (
            <span key={cor} className={cn("h-full transition-[width] duration-700", cor)} style={{ width: `${v}%`, ...suave }} />
          ))}
        </div>
        <div className="t-pequeno mt-1.5 flex justify-between text-texto-2 tabular-nums">
          {(
            [
              ["verde", info.verde],
              ["cereja", info.cereja],
              ["boia", info.boia],
            ] as const
          ).map(([nome, v]) => (
            <span key={nome}>
              {nome}{" "}
              <span className="text-texto">
                <Numero valor={v} animar={animar} />%
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <p className="t-rotulo text-[0.6875rem] text-texto-2">Tamanho do fruto</p>
          <p className="t-dado text-[0.8125rem] text-texto tabular-nums">
            <Numero valor={info.diametro} casas={1} animar={animar} /> mm
          </p>
        </div>
        <div className="relative mt-2 h-1.5 rounded-full bg-superficie-2">
          {Array.from({ length: DIAMETRO.max - DIAMETRO.min - 1 }, (_, i) => (
            <span
              key={i}
              className="absolute top-0 h-full w-px bg-linha"
              style={{ left: `${((i + 1) / (DIAMETRO.max - DIAMETRO.min)) * 100}%` }}
            />
          ))}
          <span
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-superficie bg-caramelo shadow-cartao transition-[left] duration-700"
            style={{ left: `${pos}%`, ...suave }}
          />
        </div>
        <div className="t-pequeno mt-1 flex justify-between text-texto-2">
          <span>{DIAMETRO.min} mm</span>
          <span>{DIAMETRO.max} mm</span>
        </div>
      </div>

      <p className="mt-2.5 border-t border-linha pt-2 text-[0.6875rem] leading-snug text-texto-2">
        Valores ilustrativos. Maturação e tamanho: em estudo.
      </p>
    </div>
  );
}

type Medidas = { w: number; h: number; cw: number; ch: number };

// O cartão vai para o lado do talhão (direita, esquerda, acima ou abaixo), preso
// dentro do mapa (com uma pequena sobra para os lados). Entre as quatro posições,
// fica a que menos cobre o talhão, e nunca a que cobre o marcador. Tudo em px.
type Alvo = { x: number; y: number; l: number; r: number; t: number; b: number };
function lugarDoCartao(c: Alvo, m: Medidas) {
  const prender = (v: number, min: number, max: number) => Math.max(min, Math.min(v, Math.max(min, max)));
  const vertical = prender(c.y - m.ch / 2, 0, m.h - m.ch);
  const horizontal = prender(c.x - m.cw / 2, -SOBRA, m.w + SOBRA - m.cw);
  const opcoes = [
    { lado: "direita" as const, left: prender(c.r + VAO, -SOBRA, m.w + SOBRA - m.cw), top: vertical },
    { lado: "esquerda" as const, left: prender(c.l - VAO - m.cw, -SOBRA, m.w + SOBRA - m.cw), top: vertical },
    { lado: "acima" as const, left: horizontal, top: prender(c.t - VAO - m.ch, 0, m.h - m.ch) },
    { lado: "abaixo" as const, left: horizontal, top: prender(c.b + VAO, 0, m.h - m.ch) },
  ];
  const cobre = (o: (typeof opcoes)[number]) => {
    const w = Math.max(0, Math.min(o.left + m.cw, c.r) - Math.max(o.left, c.l));
    const h = Math.max(0, Math.min(o.top + m.ch, c.b) - Math.max(o.top, c.t));
    const marcador = c.x > o.left - 18 && c.x < o.left + m.cw + 18 && c.y > o.top - 18 && c.y < o.top + m.ch + 18;
    return w * h + (marcador ? 1e7 : 0);
  };
  return opcoes.reduce((melhor, o) => (cobre(o) < cobre(melhor) - 1 ? o : melhor));
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
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [ativo, setAtivo] = useState(inicial);
  const [explorando, setExplorando] = useState(false);
  const [mexeu, setMexeu] = useState(false); // o cartão só desliza depois da primeira troca
  const [med, setMed] = useState<Medidas | null>(null);
  const reduzido = useConsulta("(prefers-reduced-motion: reduce)", false);
  const largo = useConsulta("(min-width: 768px)", true);
  const caixaRef = useRef<HTMLDivElement>(null);
  const cartaoRef = useRef<HTMLDivElement>(null);
  const m = mapa as Mapa;
  const t = m.talhoes[ativo];
  const info = infos[ativo];

  useEffect(() => {
    const caixa = caixaRef.current;
    const cartao = cartaoRef.current;
    if (!caixa || !cartao) return;
    const medir = () => setMed({ w: caixa.clientWidth, h: caixa.clientHeight, cw: cartao.offsetWidth, ch: cartao.offsetHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(caixa);
    ro.observe(cartao);
    return () => ro.disconnect();
  }, []);

  // talhão na tela (px): centro da parte visível e a caixa dela
  const naTela = (x: InfoTalhao) => {
    const em = (p: [number, number]) => posicaoNaTela(m, p);
    const c = em(x.centro);
    const [x0, y0, x1, y1] = x.caixa;
    const cantos = [em([x0, y0]), em([x1, y0]), em([x0, y1]), em([x1, y1])];
    const w = med?.w ?? 0;
    const h = med?.h ?? 0;
    return {
      x: (c.esquerda / 100) * w,
      y: (c.topo / 100) * h,
      l: (Math.min(...cantos.map((k) => k.esquerda)) / 100) * w,
      r: (Math.max(...cantos.map((k) => k.esquerda)) / 100) * w,
      t: (Math.min(...cantos.map((k) => k.topo)) / 100) * h,
      b: (Math.max(...cantos.map((k) => k.topo)) / 100) * h,
      pct: c,
    };
  };
  const alvo = naTela(info);
  const lugar = med ? lugarDoCartao(alvo, med) : null;
  const animar = !reduzido && mexeu;
  const suave = { transitionTimingFunction: EASE, transitionDuration: animar ? "500ms" : "0ms" };

  const escolher = (i: number) => {
    if (i === ativo) return;
    setMexeu(true);
    setAtivo(i);
  };

  // setas seguem o desenho: vai para o talhão mais próximo naquela direção
  const vizinho = (dx: number, dy: number) => {
    const a = naTela(info).pct;
    let melhor = ativo;
    let nota = Infinity;
    for (const x of infos) {
      if (x.id === ativo) continue;
      const b = posicaoNaTela(m, x.centro);
      const vx = b.esquerda - a.esquerda;
      const vy = (b.topo - a.topo) * 0.72; // o mapa é mais largo que alto
      const frente = vx * dx + vy * dy;
      if (frente <= 0) continue;
      const lado = Math.abs(vx * dy - vy * dx);
      const n = frente + lado * 2.2;
      if (n < nota) {
        nota = n;
        melhor = x.id;
      }
    }
    return melhor;
  };

  const teclado = (e: React.KeyboardEvent) => {
    const dir: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    if (dir[e.key]) escolher(vizinho(...dir[e.key]));
    else if (e.key === "Home") escolher(0);
    else if (e.key === "End") escolher(infos.length - 1);
    else return;
    e.preventDefault();
  };

  const vb = `${-m.margem} ${-m.margem} ${m.largura + 2 * m.margem} ${m.altura + 2 * m.margem}`;
  const girar = m.angulo ? `rotate(${m.angulo} ${m.largura / 2} ${m.altura / 2})` : undefined;
  // fio do marcador até a borda mais próxima do cartão
  const fio = (() => {
    if (!lugar || !med) return null;
    const { left, top } = lugar;
    const [x, y] = [alvo.x, alvo.y];
    if (lugar.lado === "direita" && left > x + 8) return { left: x + 8, top: y, width: left - x - 8, height: 1 };
    if (lugar.lado === "esquerda" && left + med.cw < x - 8) return { left: left + med.cw, top: y, width: x - 8 - left - med.cw, height: 1 };
    if (lugar.lado === "acima" && top + med.ch < y - 8) return { left: x, top: top + med.ch, width: 1, height: y - 8 - top - med.ch };
    if (lugar.lado === "abaixo" && top > y + 8) return { left: x, top: y + 8, width: 1, height: top - y - 8 };
    return null;
  })();

  return (
    <div>
      <div
        ref={caixaRef}
        tabIndex={0}
        role="listbox"
        aria-label="Talhões do mapa, com valores ilustrativos. Use as setas para trocar de talhão."
        aria-activedescendant={`${id}-op-${ativo}`}
        onKeyDown={teclado}
        onPointerEnter={(e) => e.pointerType === "mouse" && setExplorando(true)}
        onPointerLeave={() => setExplorando(false)}
        onFocus={() => setExplorando(true)}
        onBlur={() => setExplorando(false)}
        className="relative rounded-g outline-none focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-4 focus-visible:ring-offset-fundo"
      >
        <div aria-hidden>{children}</div>

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
                  onPointerEnter={(e) => e.pointerType === "mouse" && escolher(tl.id)}
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
                  className={cn("stroke-texto", mexeu && "contorno-entra")}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            </g>
            {/* marcador no centro da parte visível do talhão, deslizando de um para outro */}
            <g
              className="pointer-events-none transition-transform"
              style={{ transform: `translate(${info.centro[0]}px, ${info.centro[1]}px)`, ...suave }}
            >
              <circle r={13} className="fill-none stroke-texto" strokeOpacity={0.5} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              <circle r={5.5} className="fill-texto stroke-superficie" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
            </g>
          </g>
        </svg>

        {/* cartão flutuante (do tablet em diante), ao lado do talhão. Os dois cartões
            existem sempre (sem pulo na página ao carregar); só o visível anima */}
        <div className="hidden md:block">
          {fio && (
            <span
              aria-hidden
              className="pointer-events-none absolute bg-texto/50 transition-[left,top,width,height]"
              style={{ ...fio, ...suave }}
            />
          )}
          <div
            ref={cartaoRef}
            data-lado={lugar?.lado}
            className="pointer-events-none absolute top-0 left-0 transition-transform"
            style={{
              transform: `translate(${lugar?.left ?? 0}px, ${lugar?.top ?? 0}px)`,
              visibility: lugar ? undefined : "hidden",
              ...suave,
            }}
          >
            <Cartao info={info} animar={animar && largo} />
          </div>
        </div>

        {/* para leitor de tela: a lista de talhões, com o resumo de cada um */}
        <div className="sr-only">
          {infos.map((x) => (
            <div key={x.id} id={`${id}-op-${x.id}`} role="option" aria-selected={x.id === ativo}>
              {resumo(x)}
            </div>
          ))}
        </div>
      </div>

      {/* no celular, o cartão fica embaixo do mapa (toque num talhão para trocar) */}
      <Cartao info={info} animar={animar && !largo} className="mx-auto mt-5 w-full max-w-[22rem] md:hidden" />
    </div>
  );
}
