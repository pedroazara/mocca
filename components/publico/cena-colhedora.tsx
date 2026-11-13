import { useId } from "react";
import { cn } from "@/lib/utils";

// Cena do painel do Início: a colhedora de café vista de frente, trabalhando por
// cima da fileira, e o trator com o reservatório na rua ao lado. As medidas são as
// do esquema do "Como funciona" (diagrama-colhedora.tsx; 100 unidades = 1 m), agora
// com volume, sombra e movimento: as hastes vibram, o café cai, sobe pelo elevador
// de canecas, anda pela esteira de saída e cai no reservatório. O MoCCa fica num
// pórtico por cima da esteira: lê o relevo do café que passa, e o perfil medido
// segue com o café. Colhedora e trator genéricos, sem marca nem modelo.
//
// As cores da máquina, do café e do MoCCa são físicas, iguais nos dois temas. Céu,
// morros e chão vêm das variáveis de .cena-colhedora (globals.css), que mudam com
// o tema. O movimento é todo em CSS e para com movimento reduzido. Com a rolagem
// da página (rolagem-painel.tsx), o MoCCa entra na etapa 1 e a câmera (o grupo
// .cena-camera) chega perto dele.

export const CENA = { x: -250, y: -110, largura: 1400, altura: 640 };

const TRACO = "#2A1B12";
const TINTA = { luz: "#E6A46B", base: "#C6722E", sombra: "#96501F" };
const CHASSI = "#3B2A20";
const METAL = { luz: "#C9C1B6", base: "#8F867C", sombra: "#5F574F" };
const PNEU = "#221A16";
const GARRA = "#42362F";
const FAROL = "#F8E9A8";
const CREME = "#F6F1E7";
const ESCURO = "#1E1410";

const contorno = {
  stroke: TRACO,
  strokeWidth: 1.4,
  strokeLinejoin: "round",
} as const;

// --- a esteira de saída ----------------------------------------------------------
// Sai do alto da colhedora (395, 106) e sobe um pouco até a bica (721, 52.5). Tudo
// dela é desenhado deitado, num grupo girado: x ao longo da esteira, a correia em y = 6.
const INCLINACAO = 54.5 / 332;
const ANGULO = (-Math.atan(INCLINACAO) * 180) / Math.PI;
const ESTEIRA = `translate(395 106) rotate(${ANGULO.toFixed(2)})`;
const COMPRIMENTO = 328;
const CORREIA = 6;
const VOLTA = 96; // o café se repete a cada 96 unidades
const RAIO = 4.4;
const SEGUNDOS = 2.6; // para o café andar uma volta
const LEITOR = 75; // onde o MoCCa lê, ao longo da esteira

const FRUTOS = ["var(--fruto-cereja)", "var(--fruto-verde)", "var(--fruto-amarelo)", "var(--fruto-passa)"];
function corDoFruto(i: number) {
  const k = (i * 37 + 11) % 20;
  return FRUTOS[k < 13 ? 0 : k < 16 ? 1 : k < 18 ? 2 : 3];
}

// Uma volta do café na esteira: colunas de frutos que formam montes, e a linha do
// relevo por cima deles (o perfil que o MoCCa mede).
function cafeNaEsteira() {
  const frutos: { x: number; y: number; r: number; cor: string }[] = [];
  const topo: [number, number][] = [];
  let i = 0;
  for (let x = 0; x < VOLTA; x += 9.6) {
    const onda = 0.5 + 0.5 * Math.sin((2 * Math.PI * x) / VOLTA + 0.6);
    const onda2 = 0.5 + 0.5 * Math.sin((4 * Math.PI * x) / VOLTA + 2);
    const linhas = 1 + Math.round(1.8 * onda + 0.8 * onda2);
    for (let n = 0; n < linhas; n++) {
      const r = RAIO - 0.5 + ((i * 7) % 5) * 0.22;
      frutos.push({
        x: x + (n % 2 ? 4.8 : 0) + (((i * 13) % 5) - 2) * 0.35,
        y: CORREIA - RAIO - n * 8.2,
        r,
        cor: corDoFruto(i++),
      });
    }
    topo.push([x + ((linhas - 1) % 2 ? 4.8 : 0), CORREIA - RAIO - (linhas - 1) * 8.2 - RAIO - 3]);
  }
  topo.push([VOLTA + topo[0][0], topo[0][1]]);
  return {
    frutos,
    perfil: "M" + topo.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L"),
  };
}
const VOLTAS = [-VOLTA, 0, VOLTA, 2 * VOLTA, 3 * VOLTA];
const andar = {
  "--periodo": VOLTA,
  animationDuration: `${SEGUNDOS}s`,
} as React.CSSProperties;

// --- café solto --------------------------------------------------------------------
// Uma fila de frutos é um traço de pontos redondos que anda pelo caminho; cada cor
// é um traço, e juntas elas formam a mistura do café da roça (quase tudo cereja).
const FILA = [
  {
    cor: FRUTOS[0],
    traco: "0.01 9.99 0.01 19.99 0.01 9.99 0.01 19.99 0.01 19.99",
    inicio: 0,
  },
  { cor: FRUTOS[1], traco: "0.01 79.99", inicio: -20 },
  { cor: FRUTOS[2], traco: "0.01 79.99", inicio: -50 },
  { cor: FRUTOS[3], traco: "0.01 79.99", inicio: -70 },
];

function Cafe({
  d,
  segundos,
  atraso = 0,
  raio = 4.3,
}: {
  d: string;
  segundos: number;
  atraso?: number;
  raio?: number;
}) {
  return (
    <>
      {FILA.map((f) => (
        <path
          key={f.cor}
          d={d}
          fill="none"
          stroke={f.cor}
          strokeWidth={raio * 2}
          strokeLinecap="round"
          strokeDasharray={f.traco}
          className="cafe-anda"
          style={
            {
              "--inicio": `${f.inicio - atraso}px`,
              "--periodo": "80px",
              animationDuration: `${segundos}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

// frutos mais espaçados: o café que cai do pé dentro da colhedora
function Gotas({
  d,
  vao,
  segundos,
  atraso = 0,
  cor = FRUTOS[0],
}: {
  d: string;
  vao: number;
  segundos: number;
  atraso?: number;
  cor?: string;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={cor}
      strokeWidth={7.6}
      strokeLinecap="round"
      strokeDasharray={`0.01 ${vao - 0.01}`}
      className="cafe-anda"
      style={
        {
          "--inicio": `${-atraso}px`,
          "--periodo": `${vao}px`,
          animationDuration: `${segundos}s`,
        } as React.CSSProperties
      }
    />
  );
}

// --- pé de café ------------------------------------------------------------------
// A mesma silhueta do esquema (copa oval, tronco fino, cachos), com sombra e volume.
const COPA = "M0 214C42 214 66 276 69 340C71 394 52 432 24 440H-24C-52 432 -71 394 -69 340C-66 276 -42 214 0 214Z";
const TRONCO = "M-6 467L-3 438H3L6 467Z";
const CACHOS: [number, number][] = [
  [-13, 268],
  [15, 280],
  [-30, 306],
  [3, 316],
  [34, 304],
  [-46, 348],
  [-14, 356],
  [20, 346],
  [50, 356],
  [-34, 394],
  [0, 400],
  [33, 390],
];

function PeDeCafe({ x, id, balanca = false }: { x: number; id: string; balanca?: boolean }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <ellipse cx={0} cy={467} rx={60} ry={5} fill="#000" opacity={0.18} />
      <path d={TRONCO} fill="#5B3C28" {...contorno} strokeWidth={1.1} />
      <g className={balanca ? "pe-balanca" : undefined}>
        <path d={COPA} fill={`url(#${id}-copa)`} {...contorno} />
        {/* volume da copa: três saias de ramos e um brilho no alto */}
        <path
          d="M-42 302C-20 287 16 285 40 299M-58 354C-28 335 28 335 60 352M-50 406C-22 391 24 391 52 404"
          fill="none"
          stroke="#1D3A22"
          strokeOpacity={0.4}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <path
          d="M-28 248C-14 233 12 231 26 243"
          fill="none"
          stroke="#B5D99A"
          strokeOpacity={0.45}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {CACHOS.map(([cx, cy], i) => (
          <g key={`${cx} ${cy}`} transform={`rotate(${(i * 47) % 120} ${cx} ${cy})`}>
            <g fill={FRUTOS[0]} stroke="#5E1F14" strokeWidth={0.6}>
              <circle cx={cx - 4.4} cy={cy + 2} r={4.6} />
              <circle cx={cx + 4.4} cy={cy + 2} r={4.6} />
              <circle cx={cx} cy={cy - 4.6} r={4.6} />
            </g>
            <circle cx={cx - 1.4} cy={cy - 6} r={1.2} fill="#fff" fillOpacity={0.45} />
          </g>
        ))}
      </g>
    </g>
  );
}

// --- pneu visto de frente: as garras descem, como numa roda que vem para cá -------
function Pneu({ x, y, l, a, id }: { x: number; y: number; l: number; a: number; id: string }) {
  const recorte = `${id}-pneu-${x}-${y}`;
  const garras = Array.from({ length: Math.ceil(a / 16) + 2 }, (_, i) => y - 16 + i * 16);
  return (
    <g>
      <clipPath id={recorte}>
        <rect x={x} y={y} width={l} height={a} rx={l * 0.16} />
      </clipPath>
      <ellipse cx={x + l / 2} cy={y + a + 1} rx={l * 0.75} ry={4} fill="#000" opacity={0.22} />
      <rect x={x} y={y} width={l} height={a} rx={l * 0.16} fill={PNEU} />
      <g clipPath={`url(#${recorte})`}>
        <g className="pneu-gira" fill="none" stroke={GARRA} strokeWidth={5}>
          {garras.map((gy) => (
            <path key={gy} d={`M${x - 2} ${gy + 11}L${x + l / 2} ${gy + 2}L${x + l + 2} ${gy + 11}`} />
          ))}
        </g>
        <rect x={x} y={y} width={l} height={a} fill={`url(#${id}-roda)`} />
      </g>
      <rect x={x} y={y} width={l} height={a} rx={l * 0.16} fill="none" {...contorno} />
    </g>
  );
}

// --- elevador de canecas, na lateral da colhedora ------------------------------------
const CANECA = 37; // distância entre as canecas
const JANELA_ELEVADOR = { x: 352, y: 150, l: 36, a: 138 };

function Elevador({ id }: { id: string }) {
  const j = JANELA_ELEVADOR;
  const meio = j.x + j.l / 2;
  return (
    <g>
      <rect x={j.x - 5} y={j.y - 7} width={j.l + 10} height={j.a + 14} rx={5} fill={CHASSI} {...contorno} />
      <rect x={j.x} y={j.y} width={j.l} height={j.a} rx={2} fill={ESCURO} />
      <clipPath id={`${id}-elevador`}>
        <rect x={j.x} y={j.y} width={j.l} height={j.a} rx={2} />
      </clipPath>
      <g clipPath={`url(#${id}-elevador)`}>
        {/* a correia que leva as canecas */}
        <rect x={meio - 5} y={j.y} width={10} height={j.a} fill="#3A2E27" />
        <g className="caneca-sobe" style={{ "--caneca": `${CANECA}px` } as React.CSSProperties}>
          {Array.from({ length: Math.ceil(j.a / CANECA) + 2 }, (_, k) => {
            const y = j.y + 14 + k * CANECA;
            return (
              <g key={k}>
                <g fill={FRUTOS[0]}>
                  <circle cx={meio - 7.5} cy={y - 1} r={4.4} />
                  <circle cx={meio + 7.5} cy={y - 1} r={4.4} />
                  <circle
                    cx={meio}
                    cy={y - 5}
                    r={4.6}
                    fill={k % 3 === 1 ? FRUTOS[1] : k % 4 === 2 ? FRUTOS[2] : undefined}
                  />
                  <circle cx={meio - 1} cy={y + 1} r={4.2} />
                </g>
                <path
                  d={`M${meio - 14} ${y}H${meio + 14}L${meio + 10.5} ${y + 12}H${meio - 10.5}Z`}
                  fill={METAL.base}
                  stroke={TRACO}
                  strokeWidth={0.9}
                  strokeLinejoin="round"
                />
                <path d={`M${meio - 12} ${y + 2.4}H${meio + 12}`} fill="none" stroke={METAL.luz} strokeWidth={1.4} />
              </g>
            );
          })}
        </g>
        {/* sombra no alto e embaixo da janela: as canecas entram e saem do escuro */}
        <rect x={j.x} y={j.y} width={j.l} height={j.a} fill={`url(#${id}-poco)`} />
      </g>
      <path
        d={`M${j.x + 3} ${j.y + 3}V${j.y + j.a - 3}`}
        fill="none"
        stroke="#fff"
        strokeOpacity={0.16}
        strokeWidth={1.4}
      />
      <rect x={j.x} y={j.y} width={j.l} height={j.a} rx={2} fill="none" stroke={TRACO} strokeWidth={1} />
    </g>
  );
}

const MORROS = [
  {
    topo: "M-250 296C-110 236 40 246 190 268C370 294 520 214 700 228C860 240 1000 286 1150 258",
    cor: "var(--morro-1)",
    linhas: 7,
  },
  {
    topo: "M-250 352C-120 322 10 306 170 334C330 362 470 334 620 322C800 308 960 352 1150 334",
    cor: "var(--morro-2)",
    linhas: 6,
  },
  {
    topo: "M-250 404C-60 384 120 396 300 402C520 410 760 386 1150 402",
    cor: "var(--morro-3)",
    linhas: 4,
  },
];
// o resto do cafezal, lá no fundo: uma faixa de copas pequenas
const CAFEZAL = `M-250 448${"q11 -9 22 0".repeat(64)}V476H-250Z`;
const NUVEM = "M4 26C-6 25 -7 14 3 13C2 3 17 -1 22 8C28 -4 49 -2 51 11C62 9 67 22 58 26Z";

export function CenaColhedora({ className }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const u = (nome: string) => `url(#${id}-${nome})`;
  const cafe = cafeNaEsteira();

  return (
    <svg
      viewBox={`${CENA.x} ${CENA.y} ${CENA.largura} ${CENA.altura}`}
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label="Ilustração animada: a colhedora de café, vista de frente, passa por cima da fileira. As hastes vibram, o café cai, sobe pelo elevador na lateral da máquina e segue pelo tubo de saída, no alto, até o reservatório puxado por um trator na rua ao lado. O equipamento do MoCCa fica nesse tubo e mede o relevo do café que passa."
      className={cn("cena-colhedora block", className)}
    >
      <defs>
        <linearGradient id={`${id}-ceu`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--ceu-1)" />
          <stop offset="1" stopColor="var(--ceu-2)" />
        </linearGradient>
        <linearGradient id={`${id}-chao`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--chao-1)" />
          <stop offset="1" stopColor="var(--chao-2)" />
        </linearGradient>
        <radialGradient id={`${id}-copa`} cx="0.36" cy="0.24" r="0.85">
          <stop offset="0" stopColor="#74A860" />
          <stop offset="0.5" stopColor="#467A45" />
          <stop offset="1" stopColor="#2B5231" />
        </radialGradient>
        <linearGradient id={`${id}-tinta`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={TINTA.luz} />
          <stop offset="0.28" stopColor={TINTA.base} />
          <stop offset="1" stopColor={TINTA.sombra} />
        </linearGradient>
        <linearGradient id={`${id}-tinta-lado`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={TINTA.sombra} />
          <stop offset="0.45" stopColor={TINTA.base} />
          <stop offset="1" stopColor={TINTA.luz} />
        </linearGradient>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={METAL.luz} />
          <stop offset="1" stopColor={METAL.base} />
        </linearGradient>
        <linearGradient id={`${id}-vidro`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D3E2E2" />
          <stop offset="0.55" stopColor="#9DB8BC" />
          <stop offset="1" stopColor="#6F8E96" />
        </linearGradient>
        <linearGradient id={`${id}-roda`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.16} />
          <stop offset="0.3" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.7" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.5} />
        </linearGradient>
        <linearGradient id={`${id}-poco`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ESCURO} stopOpacity={0.9} />
          <stop offset="0.14" stopColor={ESCURO} stopOpacity={0} />
          <stop offset="0.86" stopColor={ESCURO} stopOpacity={0} />
          <stop offset="1" stopColor={ESCURO} stopOpacity={0.9} />
        </linearGradient>
        <linearGradient id={`${id}-tunel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0E150E" />
          <stop offset="1" stopColor="#24361F" />
        </linearGradient>
        <linearGradient id={`${id}-mocca`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFDF8" />
          <stop offset="1" stopColor="#E7DCCA" />
        </linearGradient>
        <linearGradient id={`${id}-feixe`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE3B0" stopOpacity={0.75} />
          <stop offset="1" stopColor="#FFE3B0" stopOpacity={0.12} />
        </linearGradient>
        <radialGradient id={`${id}-luz`}>
          <stop offset="0" stopColor={FAROL} stopOpacity={0.85} />
          <stop offset="1" stopColor={FAROL} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-pilha`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B85340" />
          <stop offset="1" stopColor="#84301F" />
        </linearGradient>
        {MORROS.map((m, i) => (
          <clipPath key={i} id={`${id}-morro${i}`}>
            <path d={`${m.topo}V480H-250Z`} />
          </clipPath>
        ))}
        {/* uma volta do café da esteira e o relevo dele */}
        <g id={`${id}-volta`}>
          {cafe.frutos.map((f, i) => (
            <g key={i}>
              <circle cx={f.x} cy={f.y} r={f.r} fill={f.cor} />
              <circle cx={f.x - f.r * 0.33} cy={f.y - f.r * 0.38} r={f.r * 0.28} fill="#fff" fillOpacity={0.4} />
            </g>
          ))}
        </g>
        <path id={`${id}-relevo`} d={cafe.perfil} />
      </defs>

      <g className="cena-camera">
        {/* céu e nuvens */}
        <rect x={CENA.x} y={CENA.y} width={CENA.largura} height={CENA.altura} fill={u("ceu")} />
        <g fill="var(--nuvem)" className="nuvem-passa">
          <path d={NUVEM} transform="translate(180 -92) scale(1.5)" opacity={0.55} />
          <path d={NUVEM} transform="translate(800 -70) scale(2.1)" opacity={0.7} />
          <path d={NUVEM} transform="translate(-120 96) scale(1.8)" opacity={0.65} />
        </g>

        {/* morros com o café plantado em curva de nível */}
        {MORROS.map((m, i) => (
          <g key={i}>
            <path d={`${m.topo}V480H-250Z`} fill={m.cor} />
            <g
              clipPath={u(`morro${i}`)}
              fill="none"
              stroke="var(--morro-linha)"
              strokeWidth={1.3}
              strokeOpacity={0.5 - i * 0.08}
            >
              {Array.from({ length: m.linhas }, (_, k) => (
                <path key={k} d={m.topo} transform={`translate(0 ${(k + 1) * (11 + i * 3) + k * k * 0.8})`} />
              ))}
            </g>
          </g>
        ))}

        {/* chão e o cafezal ao fundo */}
        <path d={CAFEZAL} fill="var(--mato)" />
        <rect x={CENA.x} y={456} width={CENA.largura} height={CENA.y + CENA.altura - 456} fill={u("chao")} />
        <path
          d="M-230 484h46M-96 498h70M40 482h38M140 506h84M420 486h52M500 504h66M610 488h30M890 500h74M1010 484h58M-180 516h60M300 518h44M760 516h52"
          fill="none"
          stroke="var(--chao-2)"
          strokeOpacity={0.55}
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* fileiras vizinhas */}
        <PeDeCafe x={-115} id={id} />
        <PeDeCafe x={585} id={id} />
        <PeDeCafe x={935} id={id} />

        {/* ---- trator com o reservatório ---- */}
        {[670, 822].map((x) => (
          <Pneu key={x} x={x} y={381} l={28} a={85} id={id} />
        ))}
        {/* o café cai da bica e some no monte */}
        {/* um jorro contínuo, com os frutos descendo por cima em três filas desencontradas */}
        <path d="M720 124H742L740 182H722Z" fill="#8E3626" />
        <Cafe d="M725 118V182" segundos={0.5} raio={3.7} />
        <Cafe d="M731.5 118V182" segundos={0.62} atraso={33} raio={3.7} />
        <Cafe d="M737.5 118V182" segundos={0.56} atraso={57} raio={3.7} />
        <g className="pilha-enche">
          <path
            d="M668 200Q700 158 742 156Q770 140 800 160Q836 168 852 200Z"
            fill={u("pilha")}
            stroke={TRACO}
            strokeWidth={1.2}
          />
          <g fill={FRUTOS[1]}>
            <circle cx={706} cy={180} r={3} />
            <circle cx={772} cy={160} r={3} />
            <circle cx={826} cy={186} r={3} />
          </g>
          <g fill={FRUTOS[2]}>
            <circle cx={736} cy={170} r={3} />
            <circle cx={800} cy={176} r={3} />
          </g>
          <g fill="#5E1F14" fillOpacity={0.55}>
            <circle cx={720} cy={188} r={3} />
            <circle cx={756} cy={180} r={3} />
            <circle cx={786} cy={190} r={3} />
            <circle cx={690} cy={192} r={3} />
          </g>
          <path
            d="M700 180Q716 168 734 170M764 158Q782 154 798 166"
            fill="none"
            stroke="#fff"
            strokeOpacity={0.3}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </g>
        <path d="M681 366H839L855 196H665Z" fill={u("metal")} {...contorno} />
        <path d="M665 196H855L854 208H666Z" fill={METAL.sombra} {...contorno} />
        <path
          d="M700 208L708 366M736 208L740 366M784 208L780 366M820 208L812 366"
          fill="none"
          stroke={METAL.sombra}
          strokeWidth={2.4}
          strokeOpacity={0.7}
        />
        <path d="M672 300H848" fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={1.2} />

        {[686, 804].map((x) => (
          <Pneu key={x} x={x} y={341} l={30} a={125} id={id} />
        ))}
        {/* arco de proteção, para-lamas e o tratorista */}
        <path d="M706 330V254M814 330V254" fill="none" stroke={CHASSI} strokeWidth={6} />
        <rect x={694} y={245} width={132} height={9} rx={2} fill={CHASSI} {...contorno} />
        <rect x={679} y={326} width={45} height={11} rx={3} fill="#5E3A27" {...contorno} />
        <rect x={796} y={326} width={45} height={11} rx={3} fill="#5E3A27" {...contorno} />
        <g fill="#2A1B12" fillOpacity={0.82}>
          <circle cx={760} cy={276} r={9.5} />
          <path d="M750 270Q760 258 770 270Z" />
          <path d="M741 322Q742 292 760 289Q778 292 779 322Z" />
        </g>
        <ellipse cx={760} cy={316} rx={14} ry={4} fill="none" stroke={TRACO} strokeWidth={2.4} />
        <path d="M738 412H782V324L774 316H746L738 324Z" fill="#5E3A27" {...contorno} />
        <path d="M738 330L746 322H774L782 330" fill="none" stroke="#8A5A3B" strokeWidth={1.6} />
        <rect x={745} y={344} width={30} height={42} rx={2} fill={ESCURO} />
        <path d="M747 352H773M747 360H773M747 368H773M747 376H773" fill="none" stroke="#8A7B70" strokeWidth={1.3} />
        <circle cx={760} cy={334} r={3} fill={CREME} />
        <rect x={739} y={390} width={8} height={7} rx={1.5} fill={FAROL} stroke={TRACO} strokeWidth={0.8} />
        <rect x={773} y={390} width={8} height={7} rx={1.5} fill={FAROL} stroke={TRACO} strokeWidth={0.8} />
        <rect x={745} y={400} width={30} height={14} rx={2} fill={CHASSI} {...contorno} />
        <path d="M724 421H796" fill="none" stroke={CHASSI} strokeWidth={6} strokeLinecap="round" />
        {[714, 788].map((x) => (
          <Pneu key={x} x={x} y={381} l={18} a={85} id={id} />
        ))}

        {/* ---- colhedora ---- */}
        {/* por dentro do túnel: a fileira na sombra, o pé sendo colhido e as hastes */}
        <rect x={163} y={186} width={144} height={281} fill={u("tunel")} />
        <PeDeCafe x={235} id={id} balanca />
        <Gotas d="M192 262V440" vao={62} segundos={0.9} />
        <Gotas d="M210 300V440" vao={88} segundos={1.1} atraso={30} cor={FRUTOS[1]} />
        <Gotas d="M222 330V440" vao={70} segundos={0.8} atraso={44} />
        <Gotas d="M250 318V440" vao={74} segundos={0.95} atraso={12} />
        <Gotas d="M262 286V440" vao={96} segundos={1.2} atraso={50} cor={FRUTOS[2]} />
        <Gotas d="M279 256V440" vao={58} segundos={0.85} atraso={20} />
        {[
          { eixo: 177, de: 180, ate: 224, volta: false },
          { eixo: 293, de: 290, ate: 246, volta: true },
        ].map(({ eixo, de, ate, volta }) => (
          <g key={eixo}>
            <rect
              x={eixo - 3.5}
              y={196}
              width={7}
              height={228}
              rx={3}
              fill={METAL.sombra}
              stroke={TRACO}
              strokeWidth={1}
            />
            <g
              className={cn("haste-vibra", volta && "haste-volta")}
              stroke="#E6D8A8"
              strokeOpacity={0.85}
              strokeWidth={1.9}
              strokeLinecap="round"
            >
              {Array.from({ length: 16 }, (_, k) => (
                <path key={k} d={`M${de} ${210 + k * 13.4}H${ate + (k % 2 ? (volta ? 5 : -5) : 0)}`} />
              ))}
            </g>
          </g>
        ))}
        {/* recolhedores fechando em volta do tronco */}
        <path d="M163 425L227 441V449L163 439Z" fill={u("metal")} {...contorno} strokeWidth={1.1} />
        <path d="M307 425L243 441V449L307 439Z" fill={u("metal")} {...contorno} strokeWidth={1.1} />

        <Pneu x={75} y={351} l={50} a={115} id={id} />
        <Pneu x={345} y={351} l={50} a={115} id={id} />

        {/* pórtico */}
        <path d="M163 186V436H133V342L75 302V136H395V302L337 342V436H307V186Z" fill={u("tinta")} {...contorno} />
        <path d="M163 186V436M307 186V436" fill="none" stroke={TINTA.sombra} strokeWidth={5} strokeOpacity={0.55} />
        <path
          d="M133 342V166M337 342V166M199 166H395"
          fill="none"
          stroke={TRACO}
          strokeWidth={1}
          strokeOpacity={0.55}
        />
        <path d="M77 138H393" fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.6} />
        <rect x={214} y={145} width={122} height={7} rx={1} fill={CREME} fillOpacity={0.92} />
        <path
          d="M139 228H157M139 236H157M139 244H157"
          fill="none"
          stroke={TRACO}
          strokeOpacity={0.6}
          strokeWidth={1.3}
        />
        {/* escada da cabine */}
        <path d="M85 166V309M117 166V331" fill="none" stroke={CHASSI} strokeWidth={3} />
        <path d="M85 203H117M85 242H117M85 281H117" fill="none" stroke={CHASSI} strokeWidth={2.4} />
        {/* faróis de trabalho (acesos no tema escuro) */}
        {[148, 322].map((x) => (
          <g key={x}>
            <circle cx={x} cy={202} r={34} fill={u("luz")} style={{ opacity: "var(--farol)" }} />
            <rect x={x - 9} y={197} width={18} height={10} rx={2} fill={FAROL} stroke={TRACO} strokeWidth={1} />
          </g>
        ))}

        {/* o café sobe pelo elevador de canecas até a esteira */}
        <Elevador id={id} />

        {/* motor, escapamento e corrimão */}
        <path d="M209 112H257M209 112V136M233 112V136M257 112V136" fill="none" stroke={CHASSI} strokeWidth={2.4} />
        <g fill="#8E857C">
          <circle className="fumaca" cx={301} cy={52} r={7} />
          <circle className="fumaca" cx={301} cy={52} r={7} style={{ animationDelay: "0.8s" }} />
          <circle className="fumaca" cx={301} cy={52} r={7} style={{ animationDelay: "1.6s" }} />
        </g>
        <rect x={296.5} y={66} width={9} height={38} fill={u("metal")} {...contorno} strokeWidth={1.1} />
        <rect x={294} y={60} width={14} height={7} rx={1.5} fill={CHASSI} />
        <path d="M261 136V114L273 102H347V136Z" fill={u("tinta")} {...contorno} />
        <path
          d="M279 112H338M279 118H338M279 124H338M279 130H338"
          fill="none"
          stroke={TRACO}
          strokeOpacity={0.55}
          strokeWidth={1.3}
        />

        {/* cabine */}
        <path d="M79.5 60L53 54M200.5 60L227 54" fill="none" stroke={CHASSI} strokeWidth={2.4} />
        {[43, 227].map((x) => (
          <g key={x}>
            <rect x={x} y={48} width={10} height={42} rx={2.5} fill={CHASSI} {...contorno} strokeWidth={1.1} />
            <rect x={x + 2} y={51} width={6} height={36} rx={1.5} fill="#A9C0C4" />
          </g>
        ))}
        <path d="M75 166H205V136L199 36H81L75 136Z" fill={u("tinta")} {...contorno} />
        <path d="M83 152H197L190 46H90Z" fill={u("vidro")} />
        {/* o operador, atrás do vidro */}
        <g fill="#22160F" fillOpacity={0.62}>
          <rect x={125} y={98} width={30} height={54} rx={5} fillOpacity={0.4} />
          <circle cx={140} cy={90} r={10.5} />
          <path d="M129 84Q140 70 151 84Z" />
          <path d="M117 152Q119 111 140 107Q161 111 163 152Z" />
        </g>
        <ellipse cx={140} cy={140} rx={17} ry={5} fill="none" stroke="#22160F" strokeOpacity={0.75} strokeWidth={2.6} />
        <path d="M95 52H119L101 146H87.5ZM126 52H134L116 146H108Z" fill="#fff" fillOpacity={0.2} />
        <path d="M83 152H197L190 46H90Z" fill="none" stroke={CHASSI} strokeWidth={3.2} strokeLinejoin="round" />
        <path d="M150 152L171 100" fill="none" stroke={CHASSI} strokeWidth={1.8} strokeLinecap="round" />
        <path d="M71 37V31Q140 20 209 31V37Z" fill="#EFE6D6" {...contorno} />
        <rect x={84} y={30.5} width={15} height={5.5} rx={1.5} fill={FAROL} stroke={TRACO} strokeWidth={0.8} />
        <rect x={181} y={30.5} width={15} height={5.5} rx={1.5} fill={FAROL} stroke={TRACO} strokeWidth={0.8} />
        <rect x={132} y={22} width={16} height={4} rx={1} fill={CHASSI} />
        <path
          d="M134 22V17A6 6 0 0 1 146 17V22Z"
          fill="#E9A23B"
          stroke={TRACO}
          strokeWidth={0.9}
          className="giroflex"
        />

        {/* ---- esteira de saída ---- */}
        {/* o cilindro que sustenta a esteira */}
        <path d="M392 170L498 124" fill="none" stroke={METAL.sombra} strokeWidth={7} strokeLinecap="round" />
        <path d="M432 152.6L498 124" fill="none" stroke={METAL.luz} strokeWidth={3.4} strokeLinecap="round" />
        <g transform={ESTEIRA}>
          <clipPath id={`${id}-esteira`}>
            <rect x={0} y={-70} width={COMPRIMENTO} height={70 + CORREIA} />
          </clipPath>
          <clipPath id={`${id}-lido`}>
            <rect x={LEITOR} y={-70} width={COMPRIMENTO - LEITOR} height={70 + CORREIA} />
          </clipPath>
          {/* a calha: o fundo escuro, com a borda de trás pintada */}
          <rect x={0} y={-34} width={COMPRIMENTO} height={34 + CORREIA} fill={ESCURO} />
          <path d={`M0 -34H${COMPRIMENTO}`} fill="none" stroke={TINTA.luz} strokeWidth={3} />
          {/* o café andando */}
          <g clipPath={u("esteira")}>
            <g className="esteira-cafe" style={andar}>
              {VOLTAS.map((x) => (
                <use key={x} href={`#${id}-volta`} x={x} />
              ))}
            </g>
          </g>
          {/* a correia, com as taliscas andando, e a viga treliçada por baixo */}
          <rect x={-2} y={CORREIA} width={COMPRIMENTO + 2} height={6} fill="#120C09" />
          <path
            d={`M0 ${CORREIA + 3}H${COMPRIMENTO}`}
            fill="none"
            stroke="#75685D"
            strokeWidth={6}
            strokeDasharray="2 10"
            className="esteira-correia"
            style={{ animationDuration: `${(SEGUNDOS * 12) / VOLTA}s` }}
          />
          <rect
            x={-2}
            y={CORREIA + 6}
            width={COMPRIMENTO + 2}
            height={8}
            fill={TINTA.base}
            {...contorno}
            strokeWidth={1.1}
          />
          <path d={`M0 ${CORREIA + 7.6}H${COMPRIMENTO}`} fill="none" stroke={TINTA.luz} strokeWidth={1.6} />
          <path
            d={`M8 ${CORREIA + 14}${"l14 11l14 -11".repeat(11)}M22 ${CORREIA + 25}H${COMPRIMENTO - 12}`}
            fill="none"
            stroke={TINTA.sombra}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <rect x={0} y={-34} width={COMPRIMENTO} height={34 + CORREIA} fill="none" stroke={TRACO} strokeWidth={1.2} />
        </g>
        {/* de onde a esteira sai, no alto do elevador */}
        <path d="M347 136H397V78H347Z" fill={u("tinta-lado")} {...contorno} />
        <rect x={344} y={72} width={56} height={8} rx={2} fill={CHASSI} {...contorno} strokeWidth={1.1} />
        {/* ---- o MoCCa, num pórtico por cima da esteira ---- */}
        {/* entra na etapa 1 da rolagem, descendo até encaixar */}
        <g data-surge="1" className="surge-desce">
          <g fill="none" stroke="#B9733F" strokeWidth={2.4}>
            <circle className="mocca-pulso" cx={457} cy={17} r={54} />
            <circle className="mocca-pulso" cx={457} cy={17} r={54} style={{ animationDelay: "1.3s" }} />
          </g>
          <g transform={ESTEIRA}>
            {/* a leitura: o feixe desce até o café */}
            <path d={`M${LEITOR - 2} -52H${LEITOR + 2}L${LEITOR + 9} ${CORREIA}H${LEITOR - 9}Z`} fill={u("feixe")} />
            <path
              d={`M${LEITOR} -52V${CORREIA}`}
              fill="none"
              stroke="#FFF1CF"
              strokeWidth={1.5}
              className="laser-pulso"
            />
            {/* depois do MoCCa, o café segue com o relevo medido por cima */}
            <g clipPath={u("lido")}>
              <g className="esteira-cafe" style={andar} fill="none" strokeLinejoin="round" strokeLinecap="round">
                {VOLTAS.map((x) => (
                  <g key={x}>
                    <use href={`#${id}-relevo`} x={x} stroke="#B9733F" strokeOpacity={0.55} strokeWidth={5} />
                    <use href={`#${id}-relevo`} x={x} stroke="#FFF1CF" strokeWidth={1.8} />
                  </g>
                ))}
              </g>
            </g>
            {/* pernas do pórtico, presas à viga */}
            {[LEITOR - 43, LEITOR + 38].map((x) => (
              <g key={x}>
                <rect x={x} y={-54} width={5} height={CORREIA + 68} fill={CHASSI} stroke={TRACO} strokeWidth={0.8} />
                <rect
                  x={x - 3}
                  y={CORREIA + 5}
                  width={11}
                  height={10}
                  rx={1.5}
                  fill={CHASSI}
                  stroke={TRACO}
                  strokeWidth={0.8}
                />
              </g>
            ))}
            {/* antena do GPS */}
            <rect x={LEITOR - 34} y={-120} width={5} height={10} fill={CHASSI} />
            <path
              d={`M${LEITOR - 40.5} -119A9 6.5 0 0 1 ${LEITOR - 22.5} -119Z`}
              fill={CREME}
              stroke={TRACO}
              strokeWidth={1}
            />
            {/* a caixa, com a janela de leitura embaixo */}
            <rect
              x={LEITOR - 15}
              y={-56}
              width={30}
              height={6}
              rx={1.5}
              fill={ESCURO}
              stroke={TRACO}
              strokeWidth={0.8}
            />
            <rect
              x={LEITOR - 47}
              y={-112}
              width={94}
              height={58}
              rx={11}
              fill={u("mocca")}
              stroke="var(--vermelho)"
              strokeWidth={3.2}
            />
            <rect
              x={LEITOR - 41.5}
              y={-106.5}
              width={83}
              height={47}
              rx={7}
              fill="none"
              stroke="#fff"
              strokeOpacity={0.7}
              strokeWidth={1.2}
            />
            <circle cx={LEITOR + 34} cy={-100} r={3.4} fill="#4FA862" className="mocca-led" />
            <image
              href="/logo/mocca-site-simbolo.svg"
              x={LEITOR - 17.5}
              y={-103.5}
              width={35}
              height={40.8}
              transform={`rotate(${(-ANGULO).toFixed(2)} ${LEITOR} -83)`}
            />
          </g>
        </g>

        {/* a bica: a capa curva que vira o café para baixo e a ponta de borracha.
            Vem por cima de tudo, para o café e a linha do relevo sumirem dentro dela. */}
        <path d="M696 18L722 13Q753 12 755 44V94L747 112H715L712 94V80L696 78Z" fill={u("tinta")} {...contorno} />
        <path
          d="M712 80V94H755M701 23L722 19Q747 19 749 44"
          fill="none"
          stroke={TRACO}
          strokeOpacity={0.45}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        <path d="M713 110H749L746 130H716Z" fill={PNEU} {...contorno} strokeWidth={1.1} />
        <circle cx={733} cy={52} r={4.5} fill={CHASSI} />
      </g>
    </svg>
  );
}
