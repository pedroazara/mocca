// Pilha de camadas de agricultura de precisão (seção "A colheita é a camada que
// falta"): a mesma lavoura em placas deitadas e giradas, uma sobre a outra.
// Função pura, roda no servidor como o gerarMapa; o HTML final traz o SVG pronto.
// Os desenhos das camadas são ilustrativos e determinísticos.

import type { Mapa, Ponto } from "./talhoes";

const n1 = (v: number) => Math.round(v * 10) / 10;
const PAR = /(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g;

function aleatorio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Pilha = {
  largura: number;
  altura: number;
  /** distância vertical de cada placa até a de cima; índice 0 = topo (colheita) */
  deslocamentos: number[];
  /** centro de cada placa, em % da altura, para os rótulos em HTML */
  centros: number[];
  /** borda de cima da placa do topo, em % da altura */
  topoPlaca: number;
  contorno: string;
  talhoes: { d: string; nivel: Mapa["talhoes"][number]["nivel"] }[];
  destaque: { d: string; centro: Ponto };
  matrizCurvas: string;
  /** a projeção como matriz SVG, para desenhar em coordenadas do mapa (ex.: o padrão dos pés de café) */
  matrizMapa: string;
  satelite: string[]; // 5 classes de vigor (NDVI), da mais fraca para a mais forte
  divisas: string; // divisas dos talhões, por cima da imagem
  irrigacao: string;
  adutora: string;
  zonas: string[]; // 2 zonas de dose da adubação
  amostras: Ponto[]; // pontos de amostragem de solo, já na tela
  espessura: number;
};

export function montarPilha(
  m: Mapa,
  { angulo = 26, achatamento = 0.48, vao = 60, vaoTopo = 74, espessura = 6, folga = 8, destaque = 7 } = {},
): Pilha {
  const t = (angulo * Math.PI) / 180;
  const [cos, sin, k] = [Math.cos(t), Math.sin(t), achatamento];
  const [cx, cy] = [m.largura / 2, m.altura / 2];
  const girar = (x: number, y: number): Ponto => [cos * (x - cx) - sin * (y - cy), k * (sin * (x - cx) + cos * (y - cy))];

  // enquadramento: o contorno projetado começa em `folga`
  const pts = [...m.contorno.matchAll(PAR)].map(([, a, b]) => girar(+a, +b));
  const [x0, x1] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
  const [y0, y1] = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
  const [ox, oy] = [folga - x0, folga - y0];
  const P = (x: number, y: number): Ponto => {
    const [X, Y] = girar(x, y);
    return [n1(X + ox), n1(Y + oy)];
  };
  // os caminhos do mapa só usam pares absolutos "x y" (M, L e C): a projeção é afim, então é exata
  const projetar = (d: string) => d.replace(PAR, (_, a, b) => P(+a, +b).join(" "));
  const poligono = (lista: [number, number][]) => "M" + lista.map(([x, y]) => P(x, y).join(" ")).join("L") + "Z";

  const altPlaca = y1 - y0;
  const deslocamentos = [0, vaoTopo, vaoTopo + vao, vaoTopo + 2 * vao];
  const altura = Math.ceil(deslocamentos[3] + altPlaca + espessura + 2 * folga);
  const largura = Math.ceil(x1 - x0 + 2 * folga);
  const centros = deslocamentos.map((d) => ((d + folga + altPlaca / 2) / altura) * 100);

  // satélite ou drone: mapa de vigor (NDVI) em pixels de 6 × 6, em 5 classes, como sai
  // do processamento da imagem. Campo suave (manchas de vigor, uma faixa fraca e
  // um pouco de granulado) e pixels vizinhos da mesma classe juntados por linha,
  // para o caminho ficar pequeno.
  const r = aleatorio(99);
  const LADO = 6;
  const manchas = [
    [60, 40, 55, 34, 0.55],
    [190, 110, 60, 40, 0.5],
    [150, 30, 40, 26, -0.45],
    [40, 125, 46, 30, -0.55],
    [118, 121, 26, 20, -0.4], // o talhão marcado aparece fraco também no vigor
  ];
  const vigor = (x: number, y: number) =>
    0.15 * Math.sin(x / 31 + 0.6) * Math.cos(y / 23) +
    manchas.reduce((soma, [mx, my, sx, sy, a]) => soma + a * Math.exp(-(((x - mx) / sx) ** 2 + ((y - my) / sy) ** 2) / 2), 0) +
    0.12 * (r() - 0.5);
  const celulas: number[][] = [];
  for (let y = 0; y < m.altura; y += LADO) {
    const linha: number[] = [];
    for (let x = 0; x < m.largura; x += LADO) linha.push(vigor(x + LADO / 2, y + LADO / 2));
    celulas.push(linha);
  }
  const ordem = celulas.flat().sort((p, q) => p - q);
  const corte = [0.12, 0.3, 0.55, 0.8].map((q) => ordem[Math.floor(q * (ordem.length - 1))]);
  const classe = (v: number) => corte.filter((q) => v >= q).length;
  const satelite = ["", "", "", "", ""];
  celulas.forEach((linha, iy) => {
    let ix = 0;
    while (ix < linha.length) {
      const c = classe(linha[ix]);
      let fim = ix + 1;
      while (fim < linha.length && classe(linha[fim]) === c) fim++;
      const [x0, x1, y0, y1] = [ix * LADO, fim * LADO, iy * LADO, (iy + 1) * LADO];
      satelite[c] += poligono([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
      ix = fim;
    }
  });
  const divisas = m.talhoes.map((tt) => projetar(tt.d)).join("");

  // irrigação: linhas de gotejo seguindo as ruas e uma adutora
  const irrigacao = Array.from({ length: 14 }, (_, i) => -4 + i * 11)
    .map((y) => `M${P(-10, y).join(" ")}L${P(m.largura + 10, y).join(" ")}`)
    .join("");
  const adutora = `M${P(156, -10).join(" ")}L${P(156, m.altura + 10).join(" ")}`;

  // solo e adubação: duas zonas de dose e a grade de amostragem
  const elipse = (ex: number, ey: number, rx: number, ry: number) =>
    poligono(Array.from({ length: 36 }, (_, i) => [ex + rx * Math.cos((i / 36) * 2 * Math.PI), ey + ry * Math.sin((i / 36) * 2 * Math.PI)]));
  const zonas = [elipse(70, 98, 80, 46), elipse(182, 44, 58, 34)];
  const amostras: Ponto[] = [];
  for (let y = 12, l = 0; y < m.altura; y += 24, l++)
    for (let x = 12 + (l % 2 ? 12 : 0); x < m.largura; x += 24) amostras.push(P(x, y));

  // curvas de nível: a mesma matriz, aplicada ao conjunto "cartao" (800 × 800) já escalado para o mapa
  const [sx, sy] = [m.largura / 800, m.altura / 800];
  const [e, f] = P(0, 0);
  const matriz = (a: number, b: number) =>
    `matrix(${[cos * a, k * sin * a, -sin * b, k * cos * b, e, f].map((v) => Math.round(v * 10000) / 10000).join(" ")})`;
  const matrizCurvas = matriz(sx, sy);
  const matrizMapa = matriz(1, 1);

  const alvo = m.talhoes[destaque];
  return {
    largura,
    altura,
    deslocamentos,
    centros,
    topoPlaca: (folga / altura) * 100,
    contorno: projetar(m.contorno),
    talhoes: m.talhoes.map((tt) => ({ d: projetar(tt.d), nivel: tt.nivel })),
    destaque: { d: projetar(alvo.d), centro: P(...alvo.centro) },
    matrizCurvas,
    matrizMapa,
    satelite,
    divisas,
    irrigacao,
    adutora,
    zonas,
    amostras,
    espessura,
  };
}
