import { cn } from "@/lib/utils";

// Protótipo de testes em bancada (estágio do projeto em 2026-11), redesenhado a
// partir do desenho técnico que o Pedro mandou, com os mesmos elementos: a esteira
// com o rolo e o eixo na ponta, a cobertura por cima dela, os dois motores no alto
// e o perfil de alumínio que segura a cobertura. Sem os números das legendas.
// Mesmo traço do esquema da colhedora.
//
// A esteira anda e a leitura aparece (pedido do Pedro em 2026-11-12): a cobertura é
// desenhada meio transparente, os frutos passam por baixo dela, uma faixa de luz faz
// a leitura e, depois dela, uma linha acompanha o relevo dos montes. A tecnologia de
// leitura é segredo do projeto: aqui ela é só uma caixa escura genérica e uma luz,
// sem nenhum detalhe que diga o que é.
//
// Perspectiva paralela: `c` anda ao longo da esteira, `l` na largura e `a` na altura.
// As cores vêm de --fundo-desenho (a cor atrás do desenho) e --desenho-destaque (a cobertura).

type P3 = [number, number, number];
const ponto = ([c, l, a]: P3) => [36 + 0.9 * c + 0.6 * l, 268 - 0.42 * c + 0.4 * l - a];
const n1 = (v: number) => Math.round(v * 10) / 10;
const face = (...pts: P3[]) =>
  "M" +
  pts
    .map(ponto)
    .map(([x, y]) => `${n1(x)} ${n1(y)}`)
    .join("L") +
  "Z";
const linha = (...pts: P3[]) => face(...pts).slice(0, -1);

// arco de círculo no plano do comprimento e da altura (a ponta de um rolo)
const arco = (c0: number, l: number, a0: number, r: number, de: number, ate: number): P3[] =>
  Array.from({ length: 17 }, (_, i) => {
    const t = ((de + ((ate - de) * i) / 16) * Math.PI) / 180;
    return [c0 + r * Math.cos(t), l, a0 + r * Math.sin(t)] as P3;
  });

const LINHA = {
  stroke: "currentColor",
  strokeLinejoin: "round",
  strokeLinecap: "round",
  vectorEffect: "non-scaling-stroke",
} as const;

const tom = (p: number) => `color-mix(in oklab, currentColor ${p}%, var(--fundo-desenho))`;
// o vão por baixo da cobertura: escuro nos dois temas
const ESCURO = "color-mix(in oklab, var(--espresso) 82%, var(--fundo-desenho))";
const destaque = (p: number) => `color-mix(in oklab, var(--desenho-destaque) ${p}%, var(--fundo-desenho))`;

function Peca({ d, cor, fina = false, opacidade }: { d: string; cor: string; fina?: boolean; opacidade?: number }) {
  return <path d={d} {...LINHA} style={{ fill: cor, fillOpacity: opacidade }} strokeWidth={fina ? 1 : 1.5} />;
}

// medidas (em unidades do desenho)
const FIM = 420; // comprimento da esteira
const [L0, L1] = [6, 84]; // a correia, entre os dois perfis
const COB = { c0: 150, c1: 370, t0: 245, t1: 275, l0: -4, l1: 90, boca: 26, topo: 115 }; // cobertura
const POSTE = { c0: 252, c1: 264, l0: 90, l1: 98, topo: 113 };

// --- o que passa na esteira ----------------------------------------------------------
const ID = "prototipo-bancada";
const PASSO = 140; // os montes se repetem a cada 140 unidades da esteira
const SEGUNDOS = 4.6; // para a esteira andar um passo
const R = 4.6; // raio de um fruto
const CAMADA = 6.6; // altura de uma camada de frutos
const LEITURA = 248; // onde a faixa de luz cruza a esteira
const MEIO = 45; // o meio da largura da correia
const VOLTAS = [0, 1, 2, 3];
const passo = (k: number) => `translate(${n1(0.9 * PASSO * k)} ${n1(-0.42 * PASSO * k)})`;

const FRUTOS = ["var(--fruto-cereja)", "var(--fruto-verde)", "var(--fruto-amarelo)", "var(--fruto-passa)"];
const MONTES = [
  { c: 24, l: 41, camadas: 2 },
  { c: 70, l: 49, camadas: 3 },
  { c: 116, l: 43, camadas: 1 },
];
const ALTURA = [0, 2 * R, 2 * R + CAMADA, 2 * R + 2 * CAMADA];
const ABERTURA = [0, 8, 11, 14.5];

// os frutos de um passo, já na ordem de pintar (os de trás primeiro)
function frutosDoPasso() {
  const lista: { c: number; l: number; a: number; cor: string }[] = [];
  let i = 0;
  const cor = () => {
    const k = (i++ * 37 + 11) % 20;
    return FRUTOS[k < 13 ? 0 : k < 16 ? 1 : k < 18 ? 2 : 3];
  };
  const anel = (c: number, l: number, quantos: number, raio: number, a: number, giro: number) => {
    for (let k = 0; k < quantos; k++) {
      const t = giro + (2 * Math.PI * k) / quantos;
      lista.push({ c: c + raio * Math.cos(t), l: l + raio * Math.sin(t), a, cor: cor() });
    }
  };
  for (const m of MONTES) {
    if (m.camadas === 1) anel(m.c, m.l, 4, 6.5, R, 0.4);
    if (m.camadas === 2) {
      anel(m.c, m.l, 6, 9.2, R, 0.2);
      anel(m.c, m.l, 1, 0, R, 0);
      anel(m.c, m.l, 3, 4.8, R + CAMADA, 0.9);
    }
    if (m.camadas === 3) {
      anel(m.c, m.l, 8, 12.5, R, 0.1);
      anel(m.c, m.l, 3, 4.6, R, 0.5);
      anel(m.c, m.l, 5, 7.2, R + CAMADA, 0.7);
      anel(m.c, m.l, 1, 0, R + 2 * CAMADA, 0);
    }
  }
  // alguns frutos soltos entre os montes
  for (const [c, l] of [
    [47, 64],
    [93, 27],
    [137, 60],
    [3, 24],
  ]) {
    lista.push({ c, l, a: R, cor: cor() });
  }
  const fundo = (f: { c: number; l: number; a: number }) => 0.4 * f.l - 0.42 * f.c + 0.05 * f.a;
  return lista.sort((x, y) => fundo(x) - fundo(y));
}

// o relevo dos montes ao longo do meio da esteira (a linha que a leitura deixa)
function relevoDoPasso() {
  const pts: P3[] = [];
  for (let c = 0; c <= PASSO; c += 3.5) {
    let a = 1.5;
    for (const m of MONTES) {
      const d = Math.min(Math.abs(c - m.c), PASSO - Math.abs(c - m.c));
      a += ALTURA[m.camadas] * Math.exp(-((d / ABERTURA[m.camadas]) ** 2));
    }
    pts.push([c, MEIO, a + 3]);
  }
  return linha(...pts);
}

// some com o que anda nas duas pontas da esteira: um degradê que acompanha o comprimento
const K = (0.9 * 0.4 + 0.42 * 0.6) / (0.4 * 0.4 + 0.6 * 0.6);
const aoLongo = (c: number) => [n1(36 + 0.4 * K * c), n1(268 - 0.6 * K * c)];

function Motor({ l }: { l: number }) {
  const [c0, c1, l0, l1] = [247, 273, l - 13, l + 13];
  const [base, pe, alto] = [COB.topo, COB.topo + 5, COB.topo + 36];
  return (
    <g>
      {/* flange */}
      <Peca
        d={face([c0 - 3, l0 - 3, base], [c0 - 3, l1 + 3, base], [c0 - 3, l1 + 3, pe], [c0 - 3, l0 - 3, pe])}
        cor={tom(34)}
        fina
      />
      <Peca
        d={face([c0 - 3, l1 + 3, base], [c1 + 3, l1 + 3, base], [c1 + 3, l1 + 3, pe], [c0 - 3, l1 + 3, pe])}
        cor={tom(44)}
        fina
      />
      <Peca
        d={face([c0 - 3, l0 - 3, pe], [c1 + 3, l0 - 3, pe], [c1 + 3, l1 + 3, pe], [c0 - 3, l1 + 3, pe])}
        cor={tom(26)}
        fina
      />
      {/* corpo */}
      <Peca d={face([c0, l0, pe], [c0, l1, pe], [c0, l1, alto], [c0, l0, alto])} cor={tom(62)} />
      <Peca d={face([c0, l1, pe], [c1, l1, pe], [c1, l1, alto], [c0, l1, alto])} cor={tom(74)} />
      <Peca d={face([c0, l0, alto], [c1, l0, alto], [c1, l1, alto], [c0, l1, alto])} cor={tom(48)} />
      {/* as duas tampas do motor */}
      <path
        d={[pe + 7, alto - 7].map((a) => linha([c0, l0, a], [c0, l1, a], [c1, l1, a])).join("")}
        fill="none"
        stroke="var(--fundo-desenho)"
        strokeOpacity={0.7}
        strokeWidth={1.2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

const frutos = frutosDoPasso();
const relevo = relevoDoPasso();
const LUZ = ponto([LEITURA, MEIO + 9, 105]).map(n1); // a luz na frente da caixa
const andar = {
  "--dx": `${n1(-0.9 * PASSO)}px`,
  "--dy": `${n1(0.42 * PASSO)}px`,
  animationDuration: `${SEGUNDOS}s`,
} as React.CSSProperties;

export function PrototipoBancada({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 500 338"
      role="img"
      aria-label="Desenho do protótipo de testes em bancada: uma esteira pequena, com o rolo e o eixo na ponta, leva montes de frutos por baixo de uma cobertura em forma de telhado. Dentro da cobertura, uma faixa de luz faz a leitura dos montes que passam; depois dela, uma linha acompanha o relevo de cada monte. No alto da cobertura ficam dois motores, e um perfil de alumínio ao lado da esteira segura o conjunto."
      className={cn("block h-auto w-full", className)}
    >
      <defs>
        {/* um passo da esteira: as emendas da correia e os montes de frutos */}
        <g id={`${ID}-passo`}>
          <path
            d={[0, 35, 70, 105].map((c) => linha([c, L0 + 1, 0.3], [c, L1 - 1, 0.3])).join("")}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.22}
            strokeWidth={1}
          />
          {frutos.map((f, i) => {
            const [x, y] = ponto([f.c, f.l, f.a]);
            return (
              <g key={i}>
                <circle
                  cx={n1(x)}
                  cy={n1(y)}
                  r={R}
                  fill={f.cor}
                  stroke="#2A1710"
                  strokeOpacity={0.45}
                  strokeWidth={0.6}
                />
                <circle cx={n1(x - 1.5)} cy={n1(y - 1.7)} r={1.3} fill="#fff" fillOpacity={0.4} />
              </g>
            );
          })}
        </g>
        <path id={`${ID}-relevo`} d={relevo} />
        <linearGradient
          id={`${ID}-some`}
          gradientUnits="userSpaceOnUse"
          x1={aoLongo(0)[0]}
          y1={aoLongo(0)[1]}
          x2={aoLongo(FIM)[0]}
          y2={aoLongo(FIM)[1]}
        >
          <stop offset={0.012} stopColor="#000" />
          <stop offset={0.06} stopColor="#fff" />
          <stop offset={0.93} stopColor="#fff" />
          <stop offset={0.985} stopColor="#000" />
        </linearGradient>
        <mask id={`${ID}-pontas`} maskUnits="userSpaceOnUse" x={0} y={0} width={500} height={338}>
          <rect width={500} height={338} fill={`url(#${ID}-some)`} />
        </mask>
        {/* a linha do relevo só existe depois da leitura (à esquerda dela no desenho) */}
        <clipPath id={`${ID}-lido`}>
          <rect x={0} y={0} width={n1(ponto([LEITURA, MEIO, 0])[0])} height={338} />
        </clipPath>
        <linearGradient
          id={`${ID}-luz`}
          gradientUnits="userSpaceOnUse"
          x1={n1(ponto([LEITURA, MEIO, 103])[0])}
          y1={n1(ponto([LEITURA, MEIO, 103])[1])}
          x2={n1(ponto([LEITURA, MEIO, 0])[0])}
          y2={n1(ponto([LEITURA, MEIO, 0])[1])}
        >
          <stop offset={0} stopColor="#FFE9BD" stopOpacity={0.95} />
          <stop offset={1} stopColor="#FFE9BD" stopOpacity={0.4} />
        </linearGradient>
      </defs>

      {/* sombra no chão da bancada */}
      <path
        d={face([-14, -10, -30], [FIM + 6, -10, -30], [FIM + 6, 112, -30], [-14, 112, -30])}
        fill="currentColor"
        fillOpacity={0.06}
      />

      {/* perfil de trás e a correia */}
      <Peca d={face([6, -2, 2], [FIM, -2, 2], [FIM, 6, 2], [6, 6, 2])} cor={tom(22)} fina />
      <Peca d={face([6, -2, 2], [6, 6, 2], [6, 6, -14], [6, -2, -14])} cor={tom(36)} fina />
      <Peca d={face([0, L0, 0], [FIM - 6, L0, 0], [FIM - 6, L1, 0], [0, L1, 0])} cor={tom(12)} />

      {/* a correia dá a volta no rolo da ponta; o eixo sai para o lado */}
      <Peca d={face(...arco(0, L0, -9, 9, 90, 270), ...arco(0, L1, -9, 9, 270, 90))} cor={tom(20)} />
      <Peca d={face(...arco(0, L1, -9, 9, 0, 360))} cor={tom(30)} />
      <path
        d={linha([0, L1 + 1, -9], [0, 103, -9])}
        fill="none"
        stroke={tom(70)}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <Peca d={face(...arco(0, 103, -9, 3.6, 0, 360))} cor={tom(40)} fina />

      {/* perfil da frente, com as ranhuras, e o mancal do rolo */}
      <Peca d={face([6, 84, 2], [FIM, 84, 2], [FIM, 92, 2], [6, 92, 2])} cor={tom(22)} fina />
      <Peca d={face([6, 92, 2], [FIM, 92, 2], [FIM, 92, -14], [6, 92, -14])} cor={tom(34)} />
      <Peca d={face([6, 84, 2], [6, 92, 2], [6, 92, -14], [6, 84, -14])} cor={tom(44)} fina />
      <path
        d={linha([8, 92, -4], [FIM, 92, -4]) + linha([8, 92, -9], [FIM, 92, -9])}
        fill="none"
        {...LINHA}
        strokeOpacity={0.5}
        strokeWidth={0.8}
      />
      <Peca d={face([16, 92, 9], [46, 92, 9], [46, 99, 9], [16, 99, 9])} cor={tom(18)} fina />
      <Peca d={face([16, 92, 9], [16, 99, 9], [16, 99, -17], [16, 92, -17])} cor={tom(40)} fina />
      <Peca d={face([16, 99, 9], [46, 99, 9], [46, 99, -17], [16, 99, -17])} cor={tom(28)} />
      {[
        [24, 2],
        [38, 2],
        [24, -10],
        [38, -10],
      ].map(([c, a]) => (
        <path key={`${c} ${a}`} d={face(...arco(c, 99, a, 2.4, 0, 360))} fill="currentColor" fillOpacity={0.7} />
      ))}

      {/* por dentro da cobertura: a sombra no chão, a parede de trás e a água de trás */}
      <path
        d={face([COB.c0, COB.l0, 2], [COB.c1, COB.l0, 2], [COB.c1, COB.l1, 2], [COB.c0, COB.l1, 2])}
        fill={ESCURO}
        fillOpacity={0.5}
      />
      <path
        d={face(
          [COB.c0, COB.l0, 2],
          [COB.c1, COB.l0, 2],
          [COB.t1, COB.l0, COB.topo],
          [COB.t0, COB.l0, COB.topo],
          [COB.c0, COB.l0, COB.boca],
        )}
        fill={ESCURO}
        fillOpacity={0.82}
      />
      <path
        d={face([COB.c1, COB.l0, 2], [COB.c1, COB.l1, 2], [COB.t1, COB.l1, COB.topo], [COB.t1, COB.l0, COB.topo])}
        fill={ESCURO}
        fillOpacity={0.7}
      />

      {/* a esteira andando: as emendas da correia e os frutos */}
      <g mask={`url(#${ID}-pontas)`}>
        <g className="bancada-anda" style={andar}>
          {VOLTAS.map((k) => (
            <use key={k} href={`#${ID}-passo`} transform={passo(k)} />
          ))}
        </g>
      </g>

      {/* a leitura: a caixa (sem detalhe nenhum), a faixa de luz e a linha na esteira */}
      <path
        d={face([LEITURA, MEIO, 103], [LEITURA, L0 + 3, 0.5], [LEITURA, L1 - 3, 0.5])}
        fill={`url(#${ID}-luz)`}
        className="bancada-luz"
      />
      <path
        d={linha([LEITURA, L0 + 2, 0.5], [LEITURA, L1 - 2, 0.5])}
        fill="none"
        stroke="#FFD27A"
        strokeOpacity={0.5}
        strokeWidth={6.5}
        strokeLinecap="round"
      />
      <path
        d={linha([LEITURA, L0 + 2, 0.5], [LEITURA, L1 - 2, 0.5])}
        fill="none"
        stroke="#FFF1CF"
        strokeWidth={1.8}
        strokeLinecap="round"
        className="laser-pulso"
      />
      <path
        d={face(
          [LEITURA - 9, MEIO - 9, 103],
          [LEITURA - 9, MEIO + 9, 103],
          [LEITURA - 9, MEIO + 9, 113],
          [LEITURA - 9, MEIO - 9, 113],
        )}
        fill={ESCURO}
      />
      <path
        d={face(
          [LEITURA - 9, MEIO + 9, 103],
          [LEITURA + 9, MEIO + 9, 103],
          [LEITURA + 9, MEIO + 9, 113],
          [LEITURA - 9, MEIO + 9, 113],
        )}
        fill="#17100C"
      />
      <circle cx={LUZ[0]} cy={LUZ[1]} r={2.4} fill="#FFF1CF" />

      {/* depois da leitura, os montes seguem com o relevo medido por cima */}
      <g mask={`url(#${ID}-pontas)`}>
        <g clipPath={`url(#${ID}-lido)`}>
          <g className="bancada-anda" style={andar} fill="none" strokeLinejoin="round" strokeLinecap="round">
            {VOLTAS.map((k) => (
              <g key={k} transform={passo(k)}>
                <use href={`#${ID}-relevo`} stroke="#3A2116" strokeOpacity={0.55} strokeWidth={4.6} />
                <use href={`#${ID}-relevo`} stroke="#FFF1CF" strokeWidth={1.9} />
              </g>
            ))}
          </g>
        </g>
      </g>

      {/* cobertura, meio transparente para a leitura aparecer: a água da frente, o lado e o topo */}
      <Peca
        d={face(
          [COB.c0, COB.l0, COB.boca],
          [COB.c0, COB.l1, COB.boca],
          [COB.t0, COB.l1, COB.topo],
          [COB.t0, COB.l0, COB.topo],
        )}
        cor={destaque(26)}
        opacidade={0.62}
      />
      <Peca
        d={face(
          [COB.c0, COB.l1, 2],
          [COB.c1, COB.l1, 2],
          [COB.t1, COB.l1, COB.topo],
          [COB.t0, COB.l1, COB.topo],
          [COB.c0, COB.l1, COB.boca],
        )}
        cor={destaque(44)}
        opacidade={0.3}
      />
      <Peca
        d={face(
          [COB.t0, COB.l0, COB.topo],
          [COB.t1, COB.l0, COB.topo],
          [COB.t1, COB.l1, COB.topo],
          [COB.t0, COB.l1, COB.topo],
        )}
        cor={destaque(14)}
      />

      {/* motores: o de trás e o da frente */}
      <Motor l={11} />
      <Motor l={75} />

      {/* perfil de alumínio que segura a cobertura */}
      <Peca
        d={face(
          [POSTE.c0, POSTE.l0, -14],
          [POSTE.c0, POSTE.l1, -14],
          [POSTE.c0, POSTE.l1, POSTE.topo],
          [POSTE.c0, POSTE.l0, POSTE.topo],
        )}
        cor={tom(40)}
        fina
      />
      <Peca
        d={face(
          [POSTE.c0, POSTE.l1, -14],
          [POSTE.c1, POSTE.l1, -14],
          [POSTE.c1, POSTE.l1, POSTE.topo],
          [POSTE.c0, POSTE.l1, POSTE.topo],
        )}
        cor={tom(26)}
      />
      <Peca
        d={face(
          [POSTE.c0, POSTE.l0, POSTE.topo],
          [POSTE.c1, POSTE.l0, POSTE.topo],
          [POSTE.c1, POSTE.l1, POSTE.topo],
          [POSTE.c0, POSTE.l1, POSTE.topo],
        )}
        cor={tom(18)}
        fina
      />
      <path
        d={linha([258, POSTE.l1, -12], [258, POSTE.l1, POSTE.topo - 2])}
        fill="none"
        {...LINHA}
        strokeOpacity={0.5}
        strokeWidth={0.8}
      />
      {/* cantoneiras que prendem a cobertura ao perfil */}
      {[POSTE.c0 - 12, POSTE.c1 + 2].map((c) => (
        <Peca
          key={c}
          d={face([c, POSTE.l1 - 7, 24], [c + 10, POSTE.l1 - 7, 24], [c + 10, POSTE.l1 - 7, 12], [c, POSTE.l1 - 7, 12])}
          cor={tom(52)}
          fina
        />
      ))}
    </svg>
  );
}
