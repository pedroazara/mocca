// Gera o mapa de produtividade ilustrativo do hero. As curvas de nível do fundo
// continuam por dentro da lavoura, e as faixas entre elas vão ganhando as cores
// de produção aos poucos, até a mais alta, onde fica o pin. Os valores são
// inventados para a ilustração. Grava components/publico/produtividade-dados.ts.
// Rodar com: npm run gerar:produtividade

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { aleatorio, caminho, costurar, eFechada, extremos, isolinha, morro, suavizar } from "./relevo.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

// Quadro grande: o centro (600 × 460) é o espaço do mapa na página; o resto
// são as curvas em volta, que se apagam nas bordas.
const LARGURA = 1500;
const ALTURA = 1000;
const CENTRO = [750, 500];
const PASSO = 6;
const NIVEIS = 26;

// Lavoura: um morro largo com duas manchas fortes e uma área mais fraca.
const lavoura = [
  morro({ x: 750, y: 505, sx: 260, sy: 175, a: 0.85, ang: -0.12 }),
  morro({ x: 870, y: 440, sx: 112, sy: 58, a: 0.6, ang: -0.5 }),
  morro({ x: 630, y: 570, sx: 100, sy: 56, a: 0.68, ang: 0.35 }),
  morro({ x: 748, y: 505, sx: 55, sy: 70, a: -0.16, ang: 0.6 }),
  morro({ x: 700, y: 420, sx: 60, sy: 45, a: -0.12 }),
];

// Em volta: morros baixos espalhados, só para as curvas atravessarem o quadro.
const r = aleatorio(31);
const entorno = Array.from({ length: 9 }, () =>
  morro({
    x: LARGURA * (0.03 + r() * 0.94),
    y: ALTURA * (0.03 + r() * 0.94),
    sx: 120 + r() * 160,
    sy: 140 + r() * 200,
    a: 0.18 + r() * 0.28,
    ang: r() * Math.PI,
  }),
);

const f = (x, y) => {
  let z = 0;
  for (const m of lavoura) z += m(x, y);
  for (const m of entorno) z += m(x, y);
  return z + 0.05 * Math.sin(x / 97) * Math.cos(y / 71);
};

// a lavoura é a região perto do centro (elipse)
const naLavoura = ([x, y]) => ((x - CENTRO[0]) / 380) ** 2 + ((y - CENTRO[1]) / 290) ** 2 < 1;

const { min, max } = extremos(f, LARGURA, ALTURA, PASSO);
const linhas = [];
const aneis = []; // por nível: anéis fechados dentro da lavoura
for (let k = 1; k <= NIVEIS; k++) {
  const nivel = min + ((max - min) * k) / (NIVEIS + 1);
  const doNivel = [];
  for (const l of costurar(isolinha(f, LARGURA, ALTURA, PASSO, nivel))) {
    if (l.length < 6) continue;
    const { pts, fechada } = suavizar(l);
    const d = caminho(pts, fechada);
    linhas.push(d);
    if (fechada && eFechada(l) && l.every(naLavoura) && l.length > 30) doNivel.push(d);
  }
  aneis.push(doNivel);
}

// As faixas coloridas começam no primeiro nível que fecha um anel na lavoura.
// As 3 primeiras entram com opacidade crescente (a transição); depois, cheias.
const primeiro = aneis.findIndex((a) => a.length > 0);
const coloridos = aneis.slice(primeiro).filter((a) => a.length > 0);
const total = coloridos.length;
const faixas = coloridos.map((a, i) => ({
  d: a.join(""),
  // 5 cores da legenda, da mais baixa para a mais alta
  cor: 1 + Math.min(4, Math.floor((i / total) * 5)),
  opacidade: [0.25, 0.5, 0.78][i] ?? 1,
}));

// pin no ponto mais alto
let pin = [0, 0];
let maior = -Infinity;
for (let y = 0; y <= ALTURA; y += 2)
  for (let x = 0; x <= LARGURA; x += 2)
    if (f(x, y) > maior) {
      maior = f(x, y);
      pin = [x, y];
    }

const dados = {
  largura: LARGURA,
  altura: ALTURA,
  // retângulo do mapa dentro do quadro (o que ocupa o espaço da figura)
  janela: { x: CENTRO[0] - 300, y: CENTRO[1] - 230, largura: 600, altura: 460 },
  linhas: linhas.join(""),
  faixas,
  pin,
};

const saida =
  "// Arquivo gerado por scripts/gerar-produtividade.mjs. Não editar à mão.\n\n" +
  `export const produtividade = ${JSON.stringify(dados)} as const;\n`;
writeFileSync(join(raiz, "components", "publico", "produtividade-dados.ts"), saida);
console.log(
  `produtividade: ${(saida.length / 1024).toFixed(1)} KB | ${linhas.length} linhas | ${total} faixas a partir do nível ${primeiro + 1} | pin em ${pin}`,
);
