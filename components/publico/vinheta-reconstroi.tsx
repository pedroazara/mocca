"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Vinheta "Reconstrói" do passo a passo (logo depois de "Mede"): o café medido
// vira um modelo 3D com cor. O equipamento olha o café de cima, então só a
// camada de cima é vista: atrás da varredura surgem os pontos dessa superfície
// e, logo depois, os frutos ganham forma e cor. Os frutos de baixo, que ficam
// escondidos, entram só no volume, sem cor.
// O monte gira devagar para mostrar a profundidade.
// Canvas 2D, sem bibliotecas. Só anima enquanto está na tela; com movimento
// reduzido, fica parada no meio da varredura. As cores vêm dos tokens do CSS.

type Vetor = [number, number, number];
type Rgb = [number, number, number];
type Fruto = {
  c: Vetor;
  r: number;
  tom: number;
  pontos: { q: Vetor; n: Vetor }[]; // só os pontos vistos de cima
  colorido: boolean; // o equipamento enxerga o fruto
};

const sorteio = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const limitar = (v: number) => Math.min(1, Math.max(0, v));
const sub = (a: Vetor, b: Vetor): Vetor => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vetor, b: Vetor) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a: Vetor, b: Vetor): Vetor => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vetor): Vetor => {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
};

// pontos espalhados por igual na superfície do fruto (espiral de Fibonacci)
const ESFERA: Vetor[] = Array.from({ length: 40 }, (_, k) => {
  const y = 1 - (2 * (k + 0.5)) / 40;
  const r = Math.sqrt(1 - y * y);
  const a = k * 2.39996;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
});
const ACHATAR: Vetor = [1, 0.92, 1.06]; // o fruto é um pouco ovalado
const LUZ = unit([-0.45, 0.85, -0.3]);
const ESTEIRA = { x: 10.2, z: 4.4 };

// Monte de café sobre a esteira: uma camada cheia e, por cima, camadas que
// sobem mais no meio. Os frutos são café da roça: cereja, verde, amarelo e passa.
function montarMonte(): Fruto[] {
  const altura = (x: number, z: number) =>
    4.8 * Math.exp(-(x * x) / 30 - (z * z) / 7) + 1.7 * Math.exp(-((x - 5.6) ** 2) / 5 - (z + 1) ** 2 / 4);
  const base: Omit<Fruto, "pontos" | "colorido">[] = [];
  const normais: Vetor[][] = [];
  const passo = 1.32;
  let i = 0;
  for (let camada = 0; camada < 8; camada++) {
    const y = 0.62 + camada * 1.06;
    const dx = camada % 2 ? passo / 2 : 0;
    const dz = camada % 2 ? passo * 0.29 : 0;
    for (let z = -3.9 + dz; z <= 3.9; z += passo * 0.87) {
      for (let x = -9.7 + dx; x <= 9.7; x += passo) {
        i++;
        if (camada > 0 && y > altura(x, z) + 0.55) continue;
        const k = sorteio(i * 3.1);
        const giro = sorteio(i * 5.3) * Math.PI * 2;
        const [cg, sg] = [Math.cos(giro), Math.sin(giro)];
        base.push({
          c: [x + (sorteio(i * 7.7) - 0.5) * 0.3, y + (sorteio(i * 9.1) - 0.5) * 0.14, z + (sorteio(i * 2.3) - 0.5) * 0.3],
          r: 0.6 + sorteio(i * 1.7) * 0.11,
          tom: k < 0.6 ? 0 : k < 0.74 ? 1 : k < 0.85 ? 2 : 3,
        });
        normais.push(ESFERA.map(([a, b, c]) => [a * cg - c * sg, b, a * sg + c * cg]));
      }
    }
  }

  // O que o equipamento vê de cima: a parte de cima do fruto, se nenhum outro
  // fruto estiver por cima daquele ponto.
  return base.map((fr, i) => {
    let deCima = 0;
    const pontos: Fruto["pontos"] = [];
    for (const n of normais[i]) {
      if (n[1] <= 0.08) continue;
      deCima++;
      const q: Vetor = [
        fr.c[0] + n[0] * fr.r * ACHATAR[0],
        fr.c[1] + n[1] * fr.r * ACHATAR[1],
        fr.c[2] + n[2] * fr.r * ACHATAR[2],
      ];
      const coberto = base.some(
        (o, j) => j !== i && o.c[1] > q[1] && (q[0] - o.c[0]) ** 2 + (q[2] - o.c[2]) ** 2 < (o.r * 0.95) ** 2,
      );
      if (!coberto) pontos.push({ q, n });
    }
    return { ...fr, pontos, colorido: pontos.length > deCima * 0.25 };
  });
}

// ---- cores dos tokens ---------------------------------------------------------

type Cores = { frutos: string[][]; neutro: string[]; cabeca: string; ponto: Rgb; grade: Rgb };

function lerRgb(el: Element, nome: string, padrao: Rgb): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(getComputedStyle(el).getPropertyValue(nome).trim());
  if (!m) return padrao;
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
const misturar = (a: Rgb, b: Rgb, t: number) => a.map((x, i) => Math.round(x + (b[i] - x) * t)) as Rgb;
const rgba = ([r, g, b]: Rgb, a = 1) => `rgba(${r},${g},${b},${a})`;
// brilho, luz, cor, sombra: o gradiente que dá volume ao fruto
const volume = (base: Rgb, clarear = 0.62) =>
  [misturar(base, [255, 250, 240], clarear), misturar(base, [255, 250, 240], 0.16), base, misturar(base, [20, 10, 5], 0.5)].map(
    (c) => rgba(c),
  );

function lerCores(el: Element): Cores {
  const frutos = (
    [
      ["--fruto-cereja", [162, 65, 47]],
      ["--fruto-verde", [79, 138, 74]],
      ["--fruto-amarelo", [211, 162, 58]],
      ["--fruto-passa", [110, 70, 48]],
    ] as [string, Rgb][]
  ).map(([nome, padrao]) => volume(lerRgb(el, nome, padrao)));
  const grade = lerRgb(el, "--texto-2", [110, 84, 68]);
  // sem cor: o tom neutro da superfície, puxado para o texto secundário
  const semCor = misturar(lerRgb(el, "--superficie-2", [239, 230, 218]), grade, 0.3);
  return {
    frutos,
    neutro: volume(semCor, 0.35),
    cabeca: rgba(lerRgb(el, "--superficie-2", [239, 230, 218])),
    ponto: lerRgb(el, "--caramelo", [185, 115, 63]),
    grade,
  };
}

// ---- tempo --------------------------------------------------------------------

const CICLO = 12; // segundos por volta
const VARRE = 7.5; // a varredura dura isto; depois o modelo fica pronto na tela
const S0 = -12;
const S1 = 14.5;
const T_PARADO = (VARRE * (2.5 - S0)) / (S1 - S0); // meio da varredura

function momento(t: number) {
  const u = t % CICLO;
  if (u < VARRE) return { s: S0 + ((S1 - S0) * u) / VARRE, alfa: 1 };
  if (u < CICLO - 1.5) return { s: S1, alfa: 1 };
  return { s: S1, alfa: 1 - (u - (CICLO - 1.5)) / 1.5 };
}

// ---- câmera -------------------------------------------------------------------

const GIRO = -0.46;
const BALANCO = 0.22;
const ELEVACAO = 0.5;
const DIST = 30;
const ALVO: Vetor = [0, 1.4, 0];

function camera(giro: number) {
  const C: Vetor = [
    DIST * Math.cos(ELEVACAO) * Math.sin(giro),
    ALVO[1] + DIST * Math.sin(ELEVACAO),
    -DIST * Math.cos(ELEVACAO) * Math.cos(giro),
  ];
  const F = unit(sub(ALVO, C));
  const R = unit(cruz([0, 1, 0], F));
  const U = cruz(F, R);
  // projeção normalizada (sem escala nem centro)
  const proj = (p: Vetor) => {
    const d = sub(p, C);
    const z = dot(d, F);
    return [dot(d, R) / z, -dot(d, U) / z, z] as const;
  };
  return { C, R, U, proj };
}

// Escala e centro que cabem a esteira e o monte no quadro de 240 × 150 (abaixo
// do rótulo), em qualquer ponto do balanço da câmera.
function enquadrar(W: number, H: number, topo: number) {
  const k = Math.min(W / 240, H / 150);
  const caixa = { x0: (W - 240 * k) / 2 + 8 * k, x1: (W + 240 * k) / 2 - 8 * k, y0: (H - 150 * k) / 2 + 22 * k, y1: (H + 150 * k) / 2 - 6 * k };
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const g of [GIRO - BALANCO, GIRO, GIRO + BALANCO]) {
    const { proj } = camera(g);
    for (const p of [
      [-ESTEIRA.x, 0, -ESTEIRA.z],
      [ESTEIRA.x, 0, -ESTEIRA.z],
      [-ESTEIRA.x, 0, ESTEIRA.z],
      [ESTEIRA.x, 0, ESTEIRA.z],
      [-3, topo, 0],
      [3, topo, 0],
      [-8, 8, 0], // a cabeça do feixe, no alto
      [8, 8, 0],
    ] as Vetor[]) {
      const [x, y] = proj(p);
      [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
    }
  }
  const f = Math.min((caixa.x1 - caixa.x0) / (x1 - x0), (caixa.y1 - caixa.y0) / (y1 - y0));
  return {
    f,
    cx: (caixa.x0 + caixa.x1) / 2 - f * ((x0 + x1) / 2),
    cy: (caixa.y0 + caixa.y1) / 2 - f * ((y0 + y1) / 2),
  };
}

// ---- desenho ------------------------------------------------------------------

function desenhar(
  ctx: CanvasRenderingContext2D,
  quadro: { W: number; H: number; f: number; cx: number; cy: number },
  t: number,
  cores: Cores,
  frutos: Fruto[],
  parado: boolean,
) {
  const { W, H, f, cx, cy } = quadro;
  ctx.clearRect(0, 0, W, H);
  if (!W || !H) return;

  const { C, R, U, proj: normal } = camera(parado ? GIRO : GIRO + BALANCO * Math.sin((2 * Math.PI * t) / 18));
  const proj = (p: Vetor) => {
    const [x, y, z] = normal(p);
    return [cx + f * x, cy + f * y, z] as const;
  };
  const linha = (a: Vetor, b: Vetor) => {
    const [x0, y0] = proj(a);
    const [x1, y1] = proj(b);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  };

  const { s, alfa } = momento(t);
  ctx.lineWidth = 1;

  // frutos, do fundo para a frente
  const luzTela: [number, number] = [dot(LUZ, R), -dot(LUZ, U)];
  const ordem = frutos
    .filter((fr) => fr.c[0] - fr.r < s)
    .map((fr) => ({ fr, p: proj(fr.c) }))
    .sort((a, b) => b.p[2] - a.p[2]);

  for (const { fr, p } of ordem) {
    const solido = limitar((s - 3.4 - fr.c[0]) / 1.4);

    // nuvem de pontos: a superfície vista de cima, onde a varredura já passou
    if (solido < 1) {
      for (const { q, n } of fr.pontos) {
        if (q[0] > s || dot(n, sub(C, q)) <= 0) continue;
        const luz = Math.max(0, dot(n, LUZ));
        const [x, y, z] = proj(q);
        const naLinha = s - q[0] < 0.35; // o perfil que a varredura está lendo agora
        const lado = Math.max(0.65, (f * 0.055) / z) * (naLinha ? 1.7 : 0.8 + 0.4 * luz);
        ctx.fillStyle = rgba(cores.ponto, (naLinha ? 1 : 0.3 + 0.7 * luz) * (1 - solido));
        ctx.fillRect(x - lado / 2, y - lado / 2, lado, lado);
      }
    }

    // fruto reconstruído: com cor se o equipamento o vê; os de baixo, só volume
    if (solido > 0) {
      const raio = (f * fr.r) / p[2];
      const [b0, b1, b2, b3] = fr.colorido ? cores.frutos[fr.tom] : cores.neutro;
      const g = ctx.createRadialGradient(
        p[0] + luzTela[0] * raio * 0.42,
        p[1] + luzTela[1] * raio * 0.42,
        raio * 0.04,
        p[0],
        p[1],
        raio,
      );
      g.addColorStop(0, b0);
      g.addColorStop(0.32, b1);
      g.addColorStop(0.72, b2);
      g.addColorStop(1, b3);
      ctx.globalAlpha = solido;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], raio * ACHATAR[2], raio * ACHATAR[1], 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // o feixe: sai da cabeça, no alto, e abre até a esteira, como na vinheta "Mede"
  const visivel = limitar(Math.min((s - S0) / 1.5, (12 - s) / 1.5));
  if (visivel > 0) {
    const [hx, hy] = proj([s, 7.4, 0]);
    const [ax, ay] = proj([s, 0, -ESTEIRA.z - 0.3]);
    const [bx, by] = proj([s, 0, ESTEIRA.z + 0.3]);
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.closePath();
    ctx.fillStyle = rgba(cores.ponto, 0.1 * visivel);
    ctx.fill();
    ctx.strokeStyle = rgba(cores.ponto, 0.3 * visivel);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = rgba(cores.ponto, 0.85 * visivel);
    ctx.stroke();
    // cabeça
    const l = 11 * (f / 240);
    ctx.globalAlpha = visivel;
    ctx.fillStyle = cores.cabeca;
    ctx.strokeStyle = rgba(cores.grade, 1);
    ctx.beginPath();
    ctx.roundRect(hx - l, hy - l * 0.9, 2 * l, l * 0.9, l * 0.2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(cores.ponto, 1);
    ctx.beginPath();
    ctx.arc(hx, hy, l * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // fim do ciclo: tudo some junto (menos a esteira)
  if (alfa < 1) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = `rgba(0,0,0,${1 - alfa})`;
    ctx.fillRect(0, 0, W, H);
  }

  // a esteira fica por trás de tudo
  ctx.globalCompositeOperation = "destination-over";
  // esteira: grade no chão e as bordas
  ctx.beginPath();
  for (let z = -ESTEIRA.z / 2; z <= ESTEIRA.z / 2 + 0.01; z += ESTEIRA.z / 2) linha([-ESTEIRA.x, 0, z], [ESTEIRA.x, 0, z]);
  for (let x = -ESTEIRA.x; x <= ESTEIRA.x + 0.01; x += 2) linha([x, 0, -ESTEIRA.z], [x, 0, ESTEIRA.z]);
  ctx.strokeStyle = rgba(cores.grade, 0.16);
  ctx.stroke();
  ctx.beginPath();
  linha([-ESTEIRA.x, 0, -ESTEIRA.z], [ESTEIRA.x, 0, -ESTEIRA.z]);
  linha([-ESTEIRA.x, 0, ESTEIRA.z], [ESTEIRA.x, 0, ESTEIRA.z]);
  ctx.strokeStyle = rgba(cores.grade, 0.42);
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

export function VinhetaReconstroi({ className }: { className?: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const div = caixa.current;
    const canvas = tela.current;
    const ctx = canvas?.getContext("2d");
    if (!div || !canvas || !ctx) return;

    const frutos = montarMonte();
    const topo = Math.max(...frutos.map((fr) => fr.c[1] + fr.r));
    const reduzido = matchMedia("(prefers-reduced-motion: reduce)");
    const escuro = matchMedia("(prefers-color-scheme: dark)");
    let cores = lerCores(div);
    let quadro = { W: 0, H: 0, f: 1, cx: 0, cy: 0 };
    let t = T_PARADO; // começa com a varredura no meio, para o primeiro quadro já mostrar tudo
    let ultimo = 0;
    let pedido = 0;
    let naTela = false;

    const pintar = () => desenhar(ctx, quadro, reduzido.matches ? T_PARADO : t, cores, frutos, reduzido.matches);
    const passo = (agora: number) => {
      t += Math.min(0.05, (agora - ultimo) / 1000);
      ultimo = agora;
      pintar();
      pedido = requestAnimationFrame(passo);
    };
    const ligar = () => {
      cancelAnimationFrame(pedido);
      if (naTela && !reduzido.matches && !document.hidden) {
        ultimo = performance.now();
        pedido = requestAnimationFrame(passo);
      } else pintar();
    };
    const medir = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const [W, H] = [div.clientWidth, div.clientHeight];
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      quadro = { W, H, ...enquadrar(W, H, topo) };
      pintar();
    };
    const trocarTema = () => {
      cores = lerCores(div);
      pintar();
    };

    const ro = new ResizeObserver(medir);
    ro.observe(div);
    const io = new IntersectionObserver(([e]) => {
      naTela = e.isIntersecting;
      ligar();
    });
    io.observe(div);
    const mo = new MutationObserver(trocarTema);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    escuro.addEventListener("change", trocarTema);
    reduzido.addEventListener("change", ligar);
    document.addEventListener("visibilitychange", ligar);
    medir();

    return () => {
      cancelAnimationFrame(pedido);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      escuro.removeEventListener("change", trocarTema);
      reduzido.removeEventListener("change", ligar);
      document.removeEventListener("visibilitychange", ligar);
    };
  }, []);

  return (
    <div ref={caixa} className={cn("relative h-full w-full", className)}>
      <canvas ref={tela} aria-hidden className="absolute inset-0 h-full w-full" />
      <svg viewBox="0 0 240 150" aria-hidden className="absolute inset-0 h-full w-full">
        <text x={20} y={13} className="fill-texto-2 font-dado text-[9px] tracking-[0.08em]">
          RECONSTRUÇÃO 3D
        </text>
      </svg>
    </div>
  );
}
