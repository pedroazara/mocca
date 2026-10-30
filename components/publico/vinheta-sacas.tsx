"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { useRelogioDaVinheta } from "./relogio-vinheta";

// Vinheta "Calcula" do passo a passo (logo depois de "Reconstrói"): o volume
// medido vira sacas. O café desce da moega e enche uma saca por vez; cheia, a
// saca é amarrada, ganha o carimbo de 60 kg e vai para a fila. A conta sobe junto
// com o café. A última saca fica pela metade: o resultado é uma estimativa, com
// casa decimal (3,4 sacas). As sacas aparecem em corte enquanto enchem, para o
// café ficar à vista.
// SVG com as cores dos tokens. Com movimento reduzido, fica parada no fim da conta.

const sorteio = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const limitar = (v: number) => Math.min(1, Math.max(0, v));
const suave = (u: number) => u * u * (3 - 2 * u);

const FRUTOS = ["cereja", "verde", "amarelo", "passa"] as const;
const CLASSES = ["fill-fruto-cereja", "fill-fruto-verde", "fill-fruto-amarelo", "fill-fruto-passa"];
const tomDe = (k: number) => (k < 0.6 ? 0 : k < 0.74 ? 1 : k < 0.85 ? 2 : 3);
const RAIO = 3;

const CHAO = 128;
const BOCA_X = 56; // a saca enche embaixo da moega
const BICO_Y = 56; // saída da moega
const FILA = [200, 162, 124]; // onde cada saca cheia para, da direita para a esquerda
const CHEIA = [1, 1, 1, 0.4]; // quanto vai em cada saca: 3,4 sacas no total
const TOTAL = CHEIA.reduce((a, b) => a + b);

// ---- tempo (segundos) ---------------------------------------------------------

const ENCHER = 1.5; // uma saca inteira
const FECHAR = 0.5;
const LEVAR = 0.9;
const TROCAR = 0.4; // a saca vazia seguinte chega
const QUEDA = 0.42; // do bico da moega até o café na saca
const GOTEJO = 0.06; // um fruto sai da moega a cada intervalo destes
const CICLO = 14;

type Etapa = { chega: number; enche: number; cheia: number; fechada: number };

// Quando cada saca chega, começa a encher, fica cheia e termina de ser amarrada.
function montarAgenda(): Etapa[] {
  const agenda: Etapa[] = [];
  let chega = -Infinity; // a primeira já está no lugar
  let enche = 0.6;
  for (const q of CHEIA) {
    const cheia = enche + ENCHER * q;
    const fechada = cheia + FECHAR;
    agenda.push({ chega, enche, cheia, fechada });
    chega = fechada + LEVAR / 2; // a próxima chega quando a cheia já abriu espaço
    enche = chega + TROCAR + 0.15;
  }
  return agenda;
}
const AGENDA = montarAgenda();
const T_PARADO = AGENDA[AGENDA.length - 1].cheia + 1.5; // conta pronta: 3 sacas na fila e a última pela metade

// some no fim do ciclo e volta com a moega cheia
const alfa = (t: number) => Math.min(limitar(t / 0.5), limitar((CICLO - t) / 0.8));

function estadoDaSaca(i: number, t: number) {
  const a = AGENDA[i];
  if (t < a.chega) return null;
  const vaiPraFila = i < FILA.length;
  const chegou = suave(limitar((t - a.chega) / TROCAR));
  const vai = vaiPraFila ? suave(limitar((t - a.fechada) / LEVAR)) : 0;
  const destino = vaiPraFila ? FILA[i] : BOCA_X;
  return {
    x: BOCA_X - 16 * (1 - chegou) + (destino - BOCA_X) * vai,
    y: -3 * Math.sin(Math.PI * vai),
    opacidade: chegou,
    cheio: CHEIA[i] * limitar((t - a.enche) / (ENCHER * CHEIA[i])),
    fecha: vaiPraFila ? limitar((t - a.cheia) / FECHAR) : 0,
  };
}

// ---- desenho ------------------------------------------------------------------

// saca de juta, com a origem no meio do fundo
const CORPO = "M-12 -38C-16 -30 -17 -12 -15 -3Q-14.5 0 -11 0H11Q14.5 0 15 -3C17 -12 16 -30 12 -38Z";
const PESCOCO = "M-12.6 -37.4Q-5 -38.6 -3.2 -43.5H3.2Q5 -38.6 12.6 -37.4Z";
const PESCOCO_LADOS = "M-12 -38Q-5 -38.6 -3.2 -43.5M3.2 -43.5Q5 -38.6 12 -38";
const PONTAS = "M-3.2 -43.5L-5.4 -47.6L-1.2 -45.4L0 -48.4L1.2 -45.4L5.4 -47.6L3.2 -43.5";

// moega: boca larga no alto, bico estreito embaixo
const MOEGA = `M31 26H81L61.5 50V${BICO_Y}H50.5V50Z`;

// Frutos dentro da saca, de baixo para cima (enchem nesta ordem).
const NA_SACA = (() => {
  const lista: { x: number; y: number; tom: number; ordem: number }[] = [];
  let i = 0;
  for (let n = 0; n < 7; n++) {
    const y = -3.2 - n * 5.2;
    for (let x = -12 + (n % 2) * 3; x <= 12.01; x += 6) {
      i++;
      lista.push({
        x: x + (sorteio(i * 7.7) - 0.5) * 1.2,
        y: y + (sorteio(i * 9.1) - 0.5) * 0.8,
        tom: tomDe(sorteio(i * 3.1)),
        ordem: y + (sorteio(i * 5.3) - 0.5) * 3,
      });
    }
  }
  return lista.sort((a, b) => b.ordem - a.ordem);
})();

// Frutos na moega, de cima para baixo (é nesta ordem que ela esvazia).
const NA_MOEGA = (() => {
  const lista: { x: number; y: number; tom: number; ordem: number }[] = [];
  let i = 100;
  for (let n = 0; n < 6; n++) {
    const y = 53 - n * 5;
    const meia = y >= 50 ? 5.5 : 24.5 - ((y - 27) * 19) / 23; // meia largura da moega nesta altura
    const quantos = Math.floor((2 * meia - 5) / 6) + 1;
    for (let k = 0; k < quantos; k++) {
      i++;
      lista.push({
        x: BOCA_X - (quantos - 1) * 3 + k * 6 + (sorteio(i * 7.7) - 0.5) * 1.2,
        y: y + (sorteio(i * 9.1) - 0.5) * 0.8,
        tom: tomDe(sorteio(i * 3.1)),
        ordem: y + (sorteio(i * 5.3) - 0.5) * 4,
      });
    }
  }
  return lista.sort((a, b) => a.ordem - b.ordem);
})();

type Saca = NonNullable<ReturnType<typeof estadoDaSaca>>;

function DesenhoSaca({ id, saca }: { id: string; saca: Saca }) {
  const { x, y, opacidade, cheio, fecha } = saca;
  const juta = limitar(fecha * 2); // a juta cobre o café
  const boca = 1 - limitar((fecha - 0.25) / 0.35);
  const amarrada = limitar((fecha - 0.3) / 0.4);
  const carimbo = limitar((fecha - 0.6) / 0.4);
  const frutos = NA_SACA.slice(0, Math.round(cheio * NA_SACA.length));

  return (
    <g transform={`translate(${x.toFixed(2)} ${(CHAO + y).toFixed(2)})`} opacity={opacidade}>
      {juta < 1 && (
        <>
          <path d={CORPO} className="fill-fundo" />
          <g clipPath={`url(#${id}-corpo)`}>
            {frutos.map((f, k) => (
              <use key={k} href={`#${id}-${FRUTOS[f.tom]}`} x={f.x.toFixed(2)} y={f.y.toFixed(2)} />
            ))}
          </g>
        </>
      )}
      <path
        d={CORPO}
        className="fill-superficie-2 stroke-texto-2"
        fillOpacity={juta}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {boca > 0 && (
        <ellipse
          cy={-38}
          rx={12}
          ry={2.4}
          className="fill-texto-2 stroke-texto-2"
          fillOpacity={0.22 * boca}
          strokeOpacity={boca}
          strokeWidth={1.2}
        />
      )}
      {amarrada > 0 && (
        <g opacity={amarrada}>
          <path d={PESCOCO} className="fill-superficie-2" />
          <path
            d={PESCOCO_LADOS + PONTAS}
            className="fill-superficie-2 stroke-texto-2"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <path d="M-4.2 -42.4H4.2" className="stroke-caramelo" strokeWidth={1.8} strokeLinecap="round" />
        </g>
      )}
      {carimbo > 0 && (
        <text
          y={-15}
          textAnchor="middle"
          opacity={carimbo}
          className="fill-texto-2 font-dado text-[6.5px]"
        >
          60 kg
        </text>
      )}
    </g>
  );
}

function Cena({ id, t }: { id: string; t: number }) {
  const sacas = CHEIA.map((_, i) => estadoDaSaca(i, t));
  const total = sacas.reduce((s, saca) => s + (saca?.cheio ?? 0), 0);
  const naMoega = NA_MOEGA.slice(Math.round((total / TOTAL) * NA_MOEGA.length));

  // frutos caindo do bico para a saca que está enchendo
  const caindo: { x: number; y: number; tom: number; j: number }[] = [];
  for (let j = Math.ceil((t - QUEDA) / GOTEJO); j <= Math.floor(t / GOTEJO); j++) {
    const saiu = j * GOTEJO;
    const i = AGENDA.findIndex((a) => saiu >= a.enche - QUEDA && saiu <= a.cheia - QUEDA);
    const saca = sacas[i];
    if (!saca) continue;
    const p = (t - saiu) / QUEDA;
    const pouso = CHAO - 1 - saca.cheio * 35; // o café que já está na saca
    caindo.push({
      x: BOCA_X + (sorteio(j * 1.3) - 0.5) * 4,
      y: BICO_Y + 1 + (pouso - BICO_Y - 1) * p * p,
      tom: tomDe(sorteio(j * 2.9)),
      j,
    });
  }

  return (
    <g opacity={alfa(t)}>
      <g clipPath={`url(#${id}-moega)`}>
        {naMoega.map((f, k) => (
          <use key={k} href={`#${id}-${FRUTOS[f.tom]}`} x={f.x.toFixed(2)} y={f.y.toFixed(2)} />
        ))}
      </g>
      {sacas.map((saca, i) => saca && <DesenhoSaca key={i} id={id} saca={saca} />)}
      {/* por cima da saca em corte, para o fruto cair até o café */}
      {caindo.map((f) => (
        <use
          key={f.j}
          href={`#${id}-${FRUTOS[f.tom]}`}
          transform={`translate(${f.x.toFixed(2)} ${f.y.toFixed(2)}) scale(0.85)`}
        />
      ))}
      <text x={216} y={46} textAnchor="end" className="fill-texto font-dado text-[22px] font-medium">
        {total.toFixed(1).replace(".", ",")}
      </text>
    </g>
  );
}

export function VinhetaSacas({ className }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [tela, t] = useRelogioDaVinheta<SVGSVGElement>(CICLO, T_PARADO); // o primeiro quadro já mostra a conta pronta

  return (
    <svg ref={tela} viewBox="0 0 240 150" aria-hidden className={cn("h-auto w-full", className)}>
      <defs>
        {FRUTOS.map((nome, k) => (
          <g key={nome} id={`${id}-${nome}`}>
            <circle r={RAIO} className={CLASSES[k]} />
            <circle cx={-1} cy={-1.1} r={0.85} className="fill-creme" fillOpacity={0.45} />
            <circle cx={1.2} cy={1.4} r={0.6} className="fill-espresso" fillOpacity={0.5} />
          </g>
        ))}
        <clipPath id={`${id}-corpo`}>
          <path d={CORPO} />
        </clipPath>
        <clipPath id={`${id}-moega`}>
          <path d={MOEGA} />
        </clipPath>
      </defs>

      {/* moega sobre dois pés; o café fica por dentro e o contorno por cima */}
      <path d="M34 27L30 128M78 27L82 128" className="stroke-texto-2" strokeOpacity={0.6} strokeWidth={1.2} />
      <path d={MOEGA} className="fill-fundo" />
      <Cena id={id} t={t} />
      <path d={MOEGA} fill="none" className="stroke-texto-2" strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M28 26H84" className="stroke-texto-2" strokeWidth={1.8} strokeLinecap="round" />

      <path d="M20 128.75H220" className="stroke-texto-2" strokeWidth={1.5} strokeLinecap="round" />
      <text x={216} y={58} textAnchor="end" className="fill-texto-2 font-dado text-[8px]">
        sacas de 60 kg
      </text>
      <text x={20} y={13} className="fill-texto-2 font-dado text-[9px] tracking-[0.08em]">
        ESTIMATIVA DE SACAS
      </text>
    </svg>
  );
}
