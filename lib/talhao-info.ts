// Números ilustrativos de cada talhão para o mapa interativo da página inicial
// ("O que você passa a ver"): estimativa de sacas, maturação e tamanho do fruto.
// NÃO são dados reais. As sacas saem da faixa de produtividade do talhão; a
// maturação e o tamanho do fruto têm sorteio próprio (dependem de florada,
// altitude, face e época de colheita, não da produtividade). Servem só para
// mostrar o tipo de informação que o MoCCa vai entregar. Na tela, o cartão diz
// que são ilustrativos e que maturação e tamanho ainda estão em estudo.

import type { Mapa, Ponto, Talhao } from "./talhoes";

export type InfoTalhao = {
  id: number;
  numero: string;
  nivel: Talhao["nivel"];
  areaHa: number;
  sacasHa: number;
  sacas: number;
  // maturação, em % do volume colhido (somam 100); boia = passa + seco
  verde: number;
  cereja: number;
  boia: number;
  // tamanho do fruto: diâmetro médio, em mm
  diametro: number;
  // parte do talhão que fica dentro da fazenda (o desenho corta pelo contorno):
  // centro e caixa, em coordenadas do mapa, para o marcador e o cartão
  centro: Ponto;
  caixa: [number, number, number, number]; // x0, y0, x1, y1
};

const AREA_TOTAL_HA = 140; // fazenda ilustrativa
const SACAS_HA_POR_NIVEL = [0, 17, 25, 33, 42, 52];

const sorteio = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const pares = (d: string): Ponto[] =>
  [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(([, x, y]) => [+x, +y]);

function dentro([x, y]: Ponto, pts: Ponto[]) {
  let ok = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}

// parte visível do talhão: pontos de uma grade dentro do talhão e da fazenda
function parteVisivel(t: Talhao, fazenda: Ponto[]) {
  const pts = pares(t.d);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const dentroDos = [] as Ponto[];
  for (let y = Math.min(...ys); y <= Math.max(...ys); y += 4)
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 4)
      if (dentro([x, y], pts) && dentro([x, y], fazenda)) dentroDos.push([x, y]);
  if (!dentroDos.length) return { area: 0, centro: t.centro, caixa: [t.centro[0], t.centro[1], t.centro[0], t.centro[1]] as InfoTalhao["caixa"] };
  const vx = dentroDos.map((p) => p[0]);
  const vy = dentroDos.map((p) => p[1]);
  const media = (v: number[]) => Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
  return {
    area: dentroDos.length,
    centro: [media(vx), media(vy)] as Ponto,
    caixa: [Math.min(...vx), Math.min(...vy), Math.max(...vx), Math.max(...vy)] as InfoTalhao["caixa"],
  };
}

export function infosDosTalhoes(m: Mapa): InfoTalhao[] {
  // o contorno é uma curva; os pares do caminho (pontos e controles) bastam como polígono
  const fazenda = pares(m.contorno);
  const visiveis = m.talhoes.map((t) => parteVisivel(t, fazenda));
  const total = visiveis.reduce((a, v) => a + v.area, 0);
  return m.talhoes.map((t, i) => {
    const s = (k: number) => sorteio(t.id * 7.3 + k);
    const areaHa = Math.round((visiveis[i].area / total) * AREA_TOTAL_HA * 10) / 10;
    const sacasHa = Math.round(SACAS_HA_POR_NIVEL[t.nivel] + (s(1) - 0.5) * 6);
    // derriça mecanizada: boia (passa + seco) é uma fatia grande; verde perto do recomendado
    const cereja = Math.round(42 + t.nivel * 2 + (s(2) - 0.5) * 16);
    const verde = Math.round(9 + s(3) * 12);
    const boia = 100 - cereja - verde;
    const diametro = Math.round((12.6 + (s(4) - 0.5) * 1.6) * 10) / 10;
    return {
      id: t.id,
      numero: t.numero,
      nivel: t.nivel,
      areaHa,
      sacasHa,
      sacas: Math.round(sacasHa * areaHa),
      verde,
      cereja,
      boia,
      diametro,
      centro: visiveis[i].centro,
      caixa: visiveis[i].caixa,
    };
  });
}
