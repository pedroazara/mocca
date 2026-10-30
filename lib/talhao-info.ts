// Números ilustrativos de cada talhão para o mapa interativo da página inicial
// ("O que você passa a ver"): sacas colhidas, maturação e tamanho do grão.
// NÃO são dados reais: saem da faixa de produção do talhão e de um sorteio fixo,
// só para mostrar o tipo de informação que o MoCCa vai entregar. Na tela, o
// cartão diz "valores ilustrativos". Os dados reais virão dos testes de campo.

import type { Mapa, Talhao } from "./talhoes";

export type InfoTalhao = {
  id: number;
  numero: string;
  nivel: Talhao["nivel"];
  areaHa: number;
  sacasHa: number;
  sacas: number;
  // maturação, em % do volume colhido (somam 100)
  verde: number;
  cereja: number;
  passa: number;
  // tamanho do grão: peneira média (escala de 13 a 19, em 64 avos de polegada)
  peneira: number;
};

const AREA_TOTAL_HA = 140; // fazenda ilustrativa
const SACAS_HA_POR_NIVEL = [0, 17, 25, 33, 42, 52];

const sorteio = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// área do polígono do talhão (fórmula do laço), a partir dos pares "x y" do caminho
function areaDoCaminho(d: string) {
  const pts = [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(([, x, y]) => [+x, +y]);
  let soma = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    soma += x1 * y2 - x2 * y1;
  }
  return Math.abs(soma) / 2;
}

export function infosDosTalhoes(m: Mapa): InfoTalhao[] {
  const areas = m.talhoes.map((t) => areaDoCaminho(t.d));
  const total = areas.reduce((a, b) => a + b, 0);
  return m.talhoes.map((t, i) => {
    const s = (k: number) => sorteio(t.id * 7.3 + k);
    const areaHa = Math.round(((areas[i] / total) * AREA_TOTAL_HA) * 10) / 10;
    const sacasHa = Math.round(SACAS_HA_POR_NIVEL[t.nivel] + (s(1) - 0.5) * 6);
    // talhão que produz mais tende a ter mais cereja e grão maior
    const cereja = Math.round(50 + t.nivel * 5 + (s(2) - 0.5) * 10);
    const verde = Math.round((100 - cereja) * (0.5 + s(3) * 0.25));
    const passa = 100 - cereja - verde;
    const peneira = Math.round((15 + t.nivel * 0.45 + (s(4) - 0.5) * 0.8) * 10) / 10;
    return {
      id: t.id,
      numero: t.numero,
      nivel: t.nivel,
      areaHa,
      sacasHa,
      sacas: Math.round(sacasHa * areaHa),
      verde,
      cereja,
      passa,
      peneira,
    };
  });
}
