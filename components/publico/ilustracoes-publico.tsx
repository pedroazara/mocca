import { cn } from "@/lib/utils";

// Ilustrações da seção "Para quem". Ficam sobre fundo escuro de cor fixa
// (espresso e torra, iguais nos dois temas), por isso usam creme e as cores
// físicas dos frutos. O desenho é estático e gerado aqui mesmo, sem sorteio em
// tempo de execução.

const n1 = (v: number) => Math.round(v * 10) / 10;

const sorteio = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// --- Ramo de café ---------------------------------------------------------------
// O ramo sai do canto de baixo e sobe em diagonal. Em cada nó, um par de folhas e
// um cacho de frutos, quase todos maduros (como no pé), e cada vez menores na ponta.

type Ponto = [number, number];

const RAMO: [Ponto, Ponto, Ponto, Ponto] = [
  [392, 352],
  [316, 256],
  [232, 196],
  [112, 96],
];

function noRamo(t: number): { p: Ponto; angulo: number } {
  const [a, b, c, d] = RAMO;
  const u = 1 - t;
  const ponto = (i: 0 | 1): number =>
    u * u * u * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t * t * t * d[i];
  const derivada = (i: 0 | 1): number =>
    3 * u * u * (b[i] - a[i]) + 6 * u * t * (c[i] - b[i]) + 3 * t * t * (d[i] - c[i]);
  return { p: [ponto(0), ponto(1)], angulo: (Math.atan2(derivada(1), derivada(0)) * 180) / Math.PI };
}

const NOS = [
  { t: 0.22, folha: 150, largura: 40, frutos: 8 },
  { t: 0.5, folha: 132, largura: 36, frutos: 7 },
  { t: 0.76, folha: 104, largura: 29, frutos: 6 },
  { t: 0.97, folha: 70, largura: 20, frutos: 3 },
];

function Folha({ p, angulo, comprimento: L, largura: W }: { p: Ponto; angulo: number; comprimento: number; largura: number }) {
  const ponta: Ponto = [L, L * 0.05];
  const borda = (lado: 1 | -1) =>
    `C${n1(L * 0.16)} ${n1(lado * W)} ${n1(L * 0.62)} ${n1(lado * W * 1.05)} ${n1(ponta[0])} ${n1(ponta[1])}`;
  const volta = (lado: 1 | -1) =>
    `C${n1(L * 0.62)} ${n1(lado * W * 1.05)} ${n1(L * 0.16)} ${n1(lado * W)} 0 0`;
  return (
    <g transform={`translate(${n1(p[0])} ${n1(p[1])}) rotate(${n1(angulo)})`}>
      <path d={`M0 0${borda(-1)}${volta(1)}Z`} className="fill-fruto-verde" />
      {/* metade de baixo um pouco mais escura: dá o volume da folha */}
      <path d={`M0 0L${n1(ponta[0])} ${n1(ponta[1])}${volta(1)}Z`} className="fill-espresso" fillOpacity={0.24} />
      <path d={`M0 0Q${n1(L * 0.5)} ${n1(L * 0.01)} ${n1(ponta[0])} ${n1(ponta[1])}`} fill="none" className="stroke-creme" strokeOpacity={0.45} strokeWidth={1.2} />
      {[0.22, 0.38, 0.54, 0.7].map((f) =>
        ([-1, 1] as const).map((lado) => (
          <path
            key={`${f}${lado}`}
            d={`M${n1(L * f)} ${n1(L * f * 0.05)}Q${n1(L * (f + 0.07))} ${n1(lado * W * 0.34)} ${n1(L * (f + 0.14))} ${n1(lado * W * 0.62)}`}
            fill="none"
            className="stroke-creme"
            strokeOpacity={0.2}
            strokeWidth={1}
          />
        )),
      )}
    </g>
  );
}

function Fruto({ x, y, r, cor }: { x: number; y: number; r: number; cor: string }) {
  return (
    <g transform={`translate(${n1(x)} ${n1(y)})`}>
      <circle r={r} className={cor} />
      <circle r={r} fill="none" className="stroke-espresso" strokeOpacity={0.35} strokeWidth={0.8} />
      {/* brilho e a coroa do fruto */}
      <ellipse cx={-r * 0.34} cy={-r * 0.38} rx={r * 0.3} ry={r * 0.22} className="fill-creme" fillOpacity={0.5} />
      <circle cx={r * 0.42} cy={r * 0.5} r={r * 0.16} className="fill-espresso" fillOpacity={0.6} />
    </g>
  );
}

export function RamoCafe({ className }: { className?: string }) {
  const nos = NOS.map((n) => ({ ...n, ...noRamo(n.t) }));
  const ramo = `M${RAMO[0].join(" ")}C${RAMO[1].join(" ")} ${RAMO[2].join(" ")} ${RAMO[3].join(" ")}`;
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 400 350" className={cn("block h-auto w-full", className)}>
      {nos.map((n) => (
        <Folha key={`a${n.t}`} p={n.p} angulo={n.angulo + 118} comprimento={n.folha} largura={n.largura} />
      ))}
      <path d={ramo} fill="none" className="stroke-creme" strokeOpacity={0.55} strokeWidth={4.5} strokeLinecap="round" />
      {nos.map((n) => (
        <Folha key={`b${n.t}`} p={n.p} angulo={n.angulo - 62} comprimento={n.folha * 0.92} largura={n.largura} />
      ))}
      {nos.map((n, i) =>
        Array.from({ length: n.frutos }, (_, k) => {
          const a = (k / n.frutos) * Math.PI * 2 + i;
          const d = 11 + sorteio(i * 9 + k) * 5;
          const q = sorteio(i * 5 + k * 3);
          const cor = q < 0.72 ? "fill-fruto-cereja" : q < 0.86 ? "fill-fruto-amarelo" : "fill-fruto-verde";
          return <Fruto key={`${i}-${k}`} x={n.p[0] + Math.cos(a) * d} y={n.p[1] + Math.sin(a) * d} r={9.5 + sorteio(k + i) * 2} cor={cor} />;
        }),
      )}
    </svg>
  );
}

// --- Colhedora ------------------------------------------------------------------
// Vista de frente, passando por cima da fileira, como o esquema de "Como funciona".
// Só o traço da máquina, sem rótulos. O tubo de saída, onde o equipamento fica,
// aparece mais forte, com um anel no ponto de medição.

const TUBO = "M404 270V34Q404 10 380 10H356Q340 10 340 26V40";
const PONTO: Ponto = [384, 10];
// a copa do pé: bolas de folhagem, as de baixo e de dentro um pouco mais escuras
const COPA: [number, number, number, number][] = [
  [236, 292, 26, 0.26],
  [326, 292, 26, 0.26],
  [280, 304, 30, 0.3],
  [224, 244, 28, 0.16],
  [336, 244, 28, 0.16],
  [280, 254, 36, 0.22],
  [244, 196, 30, 0.08],
  [316, 196, 30, 0.08],
  [280, 206, 32, 0.14],
  [280, 160, 30, 0],
];
const FRUTOS_DO_PE: [number, number, string][] = [
  [252, 186, "fill-fruto-cereja"],
  [300, 178, "fill-fruto-verde"],
  [236, 222, "fill-fruto-cereja"],
  [276, 210, "fill-fruto-cereja"],
  [318, 214, "fill-fruto-amarelo"],
  [228, 262, "fill-fruto-cereja"],
  [262, 250, "fill-fruto-cereja"],
  [300, 246, "fill-fruto-cereja"],
  [332, 258, "fill-fruto-amarelo"],
  [246, 292, "fill-fruto-cereja"],
  [284, 284, "fill-fruto-cereja"],
  [318, 296, "fill-fruto-verde"],
];

export function ColhedoraLinha({ className }: { className?: string }) {
  const traco = { className: "stroke-creme", fill: "none", strokeLinejoin: "round", strokeLinecap: "round" } as const;
  return (
    <svg aria-hidden focusable="false" viewBox="92 -34 372 396" className={cn("block h-auto w-full", className)}>
      <path d="M92 340H464" {...traco} strokeOpacity={0.55} strokeWidth={2} />

      {/* a fileira de café passa por baixo da máquina */}
      <path d="M280 340V300" {...traco} strokeOpacity={0.8} strokeWidth={6} />
      {COPA.map(([x, y, r, sombra]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={r} className="fill-fruto-verde" />
          {sombra > 0 && <circle cx={x} cy={y} r={r} className="fill-espresso" fillOpacity={sombra} />}
        </g>
      ))}
      {FRUTOS_DO_PE.map(([x, y, cor]) => (
        <Fruto key={`${x}-${y}`} x={x} y={y} r={6} cor={cor} />
      ))}

      {/* hastes que derriçam, uma de cada lado do pé */}
      {[186, 360].map((x) => (
        <g key={x}>
          <rect x={x} y={136} width={14} height={176} rx={7} className="fill-espresso stroke-creme" strokeOpacity={0.8} strokeWidth={1.5} />
          {Array.from({ length: 8 }, (_, i) => 150 + i * 21).map((y) => (
            <path key={y} d={x < 280 ? `M${x + 14} ${y}q12 -4 24 2` : `M${x} ${y}q-12 -4 -24 2`} {...traco} strokeOpacity={0.7} strokeWidth={1.4} />
          ))}
        </g>
      ))}

      {/* pórtico, cabine e depósito */}
      <path d="M140 312V120Q140 100 160 100H400Q420 100 420 120V312" {...traco} strokeWidth={4} />
      <path d="M170 312V128H390V312" {...traco} strokeOpacity={0.5} strokeWidth={1.6} />
      <rect x={160} y={38} width={92} height={62} rx={8} className="fill-espresso stroke-creme" strokeWidth={2.5} />
      <rect x={172} y={50} width={68} height={30} rx={4} className="fill-creme" fillOpacity={0.18} />
      <path d="M282 100L292 46H384L392 100Z" className="fill-espresso stroke-creme" strokeWidth={2.5} strokeLinejoin="round" />
      {[304, 326, 348, 368].map((x, i) => (
        <Fruto key={x} x={x} y={86 - (i % 2) * 6} r={6} cor={i === 2 ? "fill-fruto-amarelo" : "fill-fruto-cereja"} />
      ))}

      {/* tubo de saída, em dois traços; é aqui que o equipamento fica */}
      <path d={TUBO} {...traco} strokeWidth={17} />
      <path d={TUBO} fill="none" className="stroke-espresso" strokeWidth={11} strokeLinejoin="round" />

      {[155, 405].map((x) => (
        <g key={x}>
          <circle cx={x} cy={312} r={28} className="fill-espresso stroke-creme" strokeWidth={3} />
          <circle cx={x} cy={312} r={9} className="stroke-creme" fill="none" strokeOpacity={0.7} strokeWidth={2} />
        </g>
      ))}

      <circle cx={PONTO[0]} cy={PONTO[1]} r={23} {...traco} strokeOpacity={0.5} strokeWidth={1.5} />
      <circle cx={PONTO[0]} cy={PONTO[1]} r={7} className="fill-creme stroke-espresso" strokeWidth={2.5} />
    </svg>
  );
}
