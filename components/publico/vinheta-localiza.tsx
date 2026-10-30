"use client";

import { useId, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useRelogioDaVinheta } from "./relogio-vinheta";
import { DX, DY, ESCALA, Lavoura, limitar, NIVEL, suave, type TalhaoDaVinheta } from "./vinheta-mapeia";

// Vinheta "Localiza" do passo a passo, sobre a mesma lavoura do "Mapeia": a
// colhedora (o pin) passa por cada faixa de talhões, em ida e volta, e manobra por
// fora da lavoura. Atrás dela, os talhões da faixa ganham a cor da produção medida
// ali, recortada pelos próprios talhões: as únicas linhas na tela são as divisas.
// O quadro do GPS acompanha a posição dela. No fim, o mapa fica pronto.
// O caminho e o fundo (curvas de nível) vêm do servidor. Com movimento reduzido,
// fica parada no mapa pronto.

const VELOCIDADE = 110; // unidades do mapa por segundo
const COMECA = 0.6;
const LEITURA = 24; // o GPS atualiza a cada tantas unidades andadas

// posição ilustrativa perto de Lavras: a lavoura inteira tem uns 300 m
function coordenada([x, y]: [number, number]) {
  const seg = (v: number) => v.toFixed(1).replace(".", ",").padStart(4, "0");
  return [`21°14′${seg(2 + (y / 150) * 10)}″S`, `44°59′${seg(4 + ((240 - x) / 240) * 12)}″W`];
}

export function VinhetaLocalizaAnimada({
  contorno,
  talhoes,
  caminho,
  fundo,
  className,
}: {
  contorno: string;
  talhoes: TalhaoDaVinheta[];
  caminho: [number, number, number][]; // x, y e a faixa por onde passa (-1 nas manobras)
  fundo?: ReactNode;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  // distância percorrida em cada ponto e onde começa e termina a passada em cada faixa
  const percurso = useMemo(() => {
    const s = [0];
    for (let i = 1; i < caminho.length; i++)
      s.push(s[i - 1] + Math.hypot(caminho[i][0] - caminho[i - 1][0], caminho[i][1] - caminho[i - 1][1]));
    const faixas: { ini: number; fim: number; ida: boolean }[] = [];
    caminho.forEach(([x, , f], i) => {
      if (f < 0) return;
      if (!faixas[f]) faixas[f] = { ini: s[i], fim: s[i], ida: true };
      else faixas[f] = { ...faixas[f], fim: s[i], ida: x > caminho[i - 1][0] };
    });
    const termina = COMECA + s[s.length - 1] / VELOCIDADE;
    const apaga = termina + 2.6;
    return { s, faixas, termina, apaga, ciclo: apaga + 1.3 };
  }, [caminho]);

  const [tela, t] = useRelogioDaVinheta<SVGSVGElement>(percurso.ciclo, percurso.termina + 1);
  const total = percurso.s[percurso.s.length - 1];
  const andou = limitar((t - COMECA) / (percurso.termina - COMECA)) * total;
  const apaga = 1 - suave(limitar((t - percurso.apaga) / 0.9));
  const alfa = Math.min(limitar(t / 0.5), apaga);

  const ponto = (d: number): [number, number] => {
    let i = percurso.s.findIndex((s) => s >= d);
    if (i < 1) i = i < 0 ? caminho.length - 1 : 1;
    const u = limitar((d - percurso.s[i - 1]) / (percurso.s[i] - percurso.s[i - 1] || 1));
    const [a, b] = [caminho[i - 1], caminho[i]];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  };
  const aqui = ponto(andou);
  const [lat, lon] = coordenada(ponto(Math.floor(andou / LEITURA) * LEITURA));
  const [px, py] = [DX + aqui[0] * ESCALA, DY + aqui[1] * ESCALA];

  // o pedaço de cada faixa que já ganhou cor: de fora da lavoura até a colhedora
  const pintado = percurso.faixas.map((f) => {
    if (andou <= f.ini) return null;
    if (andou >= f.fim) return [-20, 260];
    return f.ida ? [-20, aqui[0]] : [aqui[0], 260];
  });

  return (
    <svg ref={tela} viewBox="0 0 240 150" aria-hidden className={cn("h-auto w-full", className)}>
      <defs>
        {pintado.map(
          (x, f) =>
            x && (
              <clipPath key={f} id={`${id}-faixa${f}`}>
                <rect x={x[0]} y={-20} width={x[1] - x[0]} height={190} />
              </clipPath>
            ),
        )}
      </defs>

      <g transform={`translate(${DX} ${DY}) scale(${ESCALA})`}>
        {/* a cor vem antes das curvas de nível, que ficam por cima, como no mapa pronto */}
        <Lavoura contorno={contorno} talhoes={talhoes} cor={talhoes.map(() => 0)}>
          <g opacity={apaga}>
            {talhoes.map(
              (tl, i) =>
                pintado[tl.faixa] && (
                  <path
                    key={i}
                    d={tl.d}
                    clipPath={`url(#${id}-faixa${tl.faixa})`}
                    className={cn(NIVEL[tl.nivel], "stroke-superficie")}
                    strokeWidth={3}
                    strokeLinejoin="round"
                  />
                ),
            )}
          </g>
          {fundo}
        </Lavoura>
      </g>

      {/* a colhedora: anel e ponto no lugar onde ela está */}
      <g opacity={alfa}>
        <circle cx={px} cy={py} r={7} fill="none" className="stroke-caramelo" strokeOpacity={0.5} strokeWidth={1} />
        <circle cx={px} cy={py} r={3.4} className="fill-caramelo stroke-superficie" strokeWidth={1.4} />
      </g>

      {/* quadro do GPS com a posição da colhedora */}
      <g transform="translate(164 3)">
        <rect width={70} height={26} rx={4} className="fill-superficie stroke-linha" strokeWidth={1} />
        <text x={35} y={11} textAnchor="middle" className="fill-texto font-dado text-[8px]">
          {lat}
        </text>
        <text x={35} y={21.5} textAnchor="middle" className="fill-texto font-dado text-[8px]">
          {lon}
        </text>
      </g>

      <text x={20} y={13} className="fill-texto-2 font-dado text-[9px] tracking-[0.08em]">
        POSIÇÃO POR GPS
      </text>
    </svg>
  );
}
