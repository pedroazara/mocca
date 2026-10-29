import { useId } from "react";
import { cn } from "@/lib/utils";
import { idCurvas } from "./curvas-de-nivel";
import { curvas } from "./curvas-dados";
import { GradeTalhoes } from "./grade-talhoes";
import { COORDENADA_LAVRAS } from "./navegacao";

// Vinhetas do passo a passo "Medir enquanto colhe" (seção 6.3, bloco 3).
// Desenho genérico: não mostra nem sugere marca ou tipo de equipamento.

// --- "Mede": café na esteira passando sob o laser -----------------------------
// O café anda da esquerda para a direita; tudo o que passa pelo laser sai com o
// perfil medido por cima. Animação só em CSS (globals.css), desligada com
// movimento reduzido. Os frutos são café da roça (cereja, verde, amarelo, passa).

const TOPO_ESTEIRA = 112;
const LASER_X = 120;
const PERIODO = 96; // a faixa de café se repete a cada 96 unidades
const RAIO = 4.6;
const VELOCIDADE = 30; // unidades por segundo
const VISIVEL = { x0: 26, x1: 214 };

const frutos = [
  { id: "cereja", classe: "fill-fruto-cereja" },
  { id: "verde", classe: "fill-fruto-verde" },
  { id: "amarelo", classe: "fill-fruto-amarelo" },
  { id: "passa", classe: "fill-fruto-passa" },
] as const;

function tomDoFruto(i: number) {
  const k = (i * 37 + 11) % 20;
  if (k < 12) return 0;
  if (k < 15) return 1;
  if (k < 17) return 2;
  return 3;
}

// Uma volta da faixa: colunas de frutos com montes que se repetem a cada PERIODO.
function faixaDeCafe() {
  const lista: { x: number; y: number; tom: number; r: number }[] = [];
  const topo: [number, number][] = [];
  let i = 0;
  for (let x = 0; x < PERIODO; x += 9.6) {
    const onda = 0.5 + 0.5 * Math.sin((2 * Math.PI * x) / PERIODO + 0.6);
    const onda2 = 0.5 + 0.5 * Math.sin((4 * Math.PI * x) / PERIODO + 2);
    const linhas = 1 + Math.round(1.8 * onda + 0.8 * onda2);
    for (let n = 0; n < linhas; n++) {
      const y = TOPO_ESTEIRA - RAIO - n * 8.2;
      // tamanho e posição variam um pouco, como frutos de verdade
      const r = RAIO - 0.5 + ((i * 7) % 5) * 0.22;
      lista.push({ x: x + (n % 2 ? 4.8 : 0) + (((i * 13) % 5) - 2) * 0.35, y, tom: tomDoFruto(i++), r });
    }
    topo.push([x + ((linhas - 1) % 2 ? 4.8 : 0), TOPO_ESTEIRA - RAIO - (linhas - 1) * 8.2 - RAIO - 2.5]);
  }
  topo.push([PERIODO + topo[0][0], topo[0][1]]);
  return { lista, topo };
}

export function VinhetaMede({ className }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { lista, topo } = faixaDeCafe();
  const perfil = "M" + topo.map(([x, y]) => `${x} ${y.toFixed(1)}`).join("L");
  const copias = [-PERIODO, 0, PERIODO, 2 * PERIODO, 3 * PERIODO];
  const andar = {
    "--periodo": PERIODO,
    animationDuration: `${PERIODO / VELOCIDADE}s`,
  } as React.CSSProperties;
  const correia = { animationDuration: `${12 / VELOCIDADE}s` };
  const rolete = { animationDuration: `${(2 * Math.PI * 6) / VELOCIDADE}s` };

  return (
    <svg viewBox="0 0 240 150" aria-hidden className={cn("h-auto w-full", className)}>
      <defs>
        {frutos.map((f) => (
          <g key={f.id} id={`${id}-${f.id}`}>
            <circle r={RAIO} className={f.classe} />
            <circle cx={-1.5} cy={-1.7} r={1.3} className="fill-creme" fillOpacity={0.45} />
            <circle cx={1.9} cy={2.1} r={0.9} className="fill-espresso" fillOpacity={0.5} />
          </g>
        ))}
        <g id={`${id}-faixa`}>
          {lista.map((g, i) => (
            <use
              key={i}
              href={`#${id}-${frutos[g.tom].id}`}
              transform={`translate(${g.x.toFixed(1)} ${g.y}) scale(${(g.r / RAIO).toFixed(2)})`}
            />
          ))}
        </g>
        <g id={`${id}-perfil`}>
          <path d={perfil} fill="none" className="stroke-caramelo" strokeWidth={1.8} strokeLinejoin="round" />
          {topo.slice(0, -1).map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={1.9} className="fill-superficie stroke-caramelo" strokeWidth={1.2} />
          ))}
        </g>
        <clipPath id={`${id}-visivel`}>
          <rect x={VISIVEL.x0} y={20} width={VISIVEL.x1 - VISIVEL.x0} height={TOPO_ESTEIRA - 20} />
        </clipPath>
        <clipPath id={`${id}-medido`}>
          <rect x={LASER_X} y={20} width={VISIVEL.x1 - LASER_X} height={TOPO_ESTEIRA - 20} />
        </clipPath>
      </defs>

      {/* laser: cabeça fixa e o feixe; o café passa por cima da parte de baixo */}
      <rect x={LASER_X - 11} y={20} width={22} height={9} rx={2} className="fill-superficie-2 stroke-texto-2" strokeWidth={1.2} />
      <circle cx={LASER_X} cy={29} r={1.6} className="fill-caramelo" />
      <polygon
        points={`${LASER_X - 1.5},30 ${LASER_X + 1.5},30 ${LASER_X + 7},${TOPO_ESTEIRA} ${LASER_X - 7},${TOPO_ESTEIRA}`}
        className="fill-caramelo"
        fillOpacity={0.14}
      />
      <line
        x1={LASER_X}
        x2={LASER_X}
        y1={30}
        y2={TOPO_ESTEIRA}
        className="laser-pulso stroke-caramelo"
        strokeWidth={1.2}
      />

      {/* café andando */}
      <g clipPath={`url(#${id}-visivel)`}>
        <g className="esteira-cafe" style={andar}>
          {copias.map((x) => (
            <use key={x} href={`#${id}-faixa`} x={x} />
          ))}
        </g>
      </g>

      {/* depois do laser, o café sai com o perfil medido */}
      <g clipPath={`url(#${id}-medido)`}>
        <g className="esteira-cafe" style={andar}>
          {copias.map((x) => (
            <use key={x} href={`#${id}-perfil`} x={x} />
          ))}
        </g>
      </g>

      {/* esteira: correia com taliscas andando e roletes girando */}
      <rect
        x={20}
        y={TOPO_ESTEIRA}
        width={200}
        height={12}
        rx={6}
        fill="none"
        className="stroke-texto-2"
        strokeWidth={1.5}
      />
      <line
        x1={VISIVEL.x0}
        x2={VISIVEL.x1}
        y1={TOPO_ESTEIRA}
        y2={TOPO_ESTEIRA}
        className="esteira-correia stroke-texto-2"
        strokeWidth={2.6}
        strokeDasharray="3 9"
        style={correia}
      />
      <line
        x1={VISIVEL.x0}
        x2={VISIVEL.x1}
        y1={TOPO_ESTEIRA + 12}
        y2={TOPO_ESTEIRA + 12}
        className="esteira-correia esteira-volta stroke-texto-2"
        strokeWidth={2.6}
        strokeDasharray="3 9"
        style={correia}
      />
      {[26, 214].map((x) => (
        <g key={x} transform={`translate(${x} ${TOPO_ESTEIRA + 6})`}>
          <g className="esteira-rolete" style={rolete}>
            <circle r={4.2} className="fill-superficie-2 stroke-texto-2" strokeWidth={1.2} />
            <path d="M-4.2 0H4.2M0 -4.2V4.2" className="stroke-texto-2" strokeWidth={1} />
          </g>
        </g>
      ))}
      <path
        d="M104 140h32m-6 -4l6 4l-6 4"
        fill="none"
        className="stroke-texto-2"
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      <text x={20} y={13} className="fill-texto-2 font-dado text-[9px] tracking-[0.08em]">
        VOLUME QUE PASSA
      </text>
    </svg>
  );
}

export function VinhetaLocaliza({ className }: { className?: string }) {
  const c = curvas.cartao;
  const pontos: [number, number][] = [
    [26, 124],
    [48, 112],
    [70, 104],
    [92, 92],
    [112, 86],
    [134, 76],
    [154, 72],
  ];
  const [px, py] = pontos[pontos.length - 1];
  return (
    <svg viewBox="0 0 240 150" aria-hidden className={cn("h-auto w-full", className)}>
      <use
        href={`#${idCurvas("cartao")}`}
        transform={`scale(${240 / c.largura} ${150 / c.altura})`}
        className="stroke-linha"
      />
      <path
        d={"M" + pontos.map(([x, y]) => `${x} ${y}`).join("L")}
        fill="none"
        className="stroke-texto-2"
        strokeWidth={1.5}
        strokeDasharray="0.1 6"
        strokeLinecap="round"
      />
      {pontos.slice(0, -1).map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={2.6} className="fill-superficie stroke-texto" strokeWidth={1.2} />
      ))}
      <circle cx={px} cy={py} r={18} fill="none" className="stroke-caramelo" strokeOpacity={0.45} strokeWidth={1} />
      <circle cx={px} cy={py} r={30} fill="none" className="stroke-caramelo" strokeOpacity={0.25} strokeWidth={1} />
      <image href="/logo/mocca-simbolo.svg" x={px - 9} y={py - 24} width={18} height={25} />
      <g transform="translate(150 22)">
        <rect width={80} height={22} rx={4} className="fill-superficie stroke-linha" strokeWidth={1} />
        <text x={40} y={14.5} textAnchor="middle" className="fill-texto font-dado text-[8.5px]">
          {COORDENADA_LAVRAS}
        </text>
      </g>
      <path d={`M${px + 6} ${py - 18}L176 44`} className="stroke-texto-2" strokeOpacity={0.5} strokeWidth={1} />
    </svg>
  );
}

export function VinhetaMapeia({ className }: { className?: string }) {
  return (
    <GradeTalhoes
      variante="mini"
      corDoVao="stroke-superficie"
      titulo="Mapa de produção ilustrativo"
      contorno={false}
      className={className}
    />
  );
}
