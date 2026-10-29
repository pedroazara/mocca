// Gera o mapa de produtividade ilustrativo do hero: uma lavoura com manchas de
// produção em 5 faixas, como num mapa de colheita. Os valores são inventados
// para a ilustração. Grava components/publico/produtividade-dados.ts.
// Rodar com: npm run gerar:produtividade

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { caminho, costurar, eFechada, isolinha, morro, suavizar } from "./relevo.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

const LARGURA = 600;
const ALTURA = 460;
const PASSO = 3;

// Contorno da lavoura: forma orgânica suave (raio que varia com o ângulo).
const C = [300, 232];
function raio(theta) {
  return (
    1 +
    0.08 * Math.cos(2 * theta + 0.6) +
    0.05 * Math.cos(3 * theta + 2.0) +
    0.03 * Math.cos(5 * theta + 0.4)
  );
}
const contornoPts = [];
for (let k = 0; k < 64; k++) {
  const a = (k / 64) * Math.PI * 2;
  contornoPts.push([C[0] + 262 * raio(a) * Math.cos(a), C[1] + 186 * raio(a) * Math.sin(a)]);
}
function dentro([x, y]) {
  const a = Math.atan2((y - C[1]) / 186, (x - C[0]) / 262);
  const r = Math.hypot((x - C[0]) / 262, (y - C[1]) / 186);
  return r < raio(a);
}

// Produção: duas manchas fortes, uma média e uma área fraca, mais ondulação.
// A janela zera a função na borda do quadro, para todas as curvas fecharem.
const manchas = [
  morro({ x: 400, y: 160, sx: 95, sy: 70, a: 1, ang: -0.4 }),
  morro({ x: 185, y: 300, sx: 80, sy: 60, a: 0.85, ang: 0.5 }),
  morro({ x: 300, y: 200, sx: 140, sy: 120, a: 0.35 }),
  morro({ x: 470, y: 330, sx: 60, sy: 48, a: 0.55, ang: 0.2 }),
];
const fraca = morro({ x: 250, y: 120, sx: 70, sy: 50, a: 0.45 });
const f = (x, y) => {
  let z = 0.25;
  for (const m of manchas) z += m(x, y);
  z -= fraca(x, y);
  // variação fina: bordas irregulares e pequenas ilhas, como num mapa de colheita real
  z += 0.07 * Math.sin(x / 37) * Math.cos(y / 29);
  z += 0.06 * Math.sin(x / 19 + 1.3) * Math.cos(y / 23 + 0.4);
  z += 0.04 * Math.sin((x + 1.7 * y) / 15);
  const janela = Math.pow(Math.sin((Math.PI * x) / LARGURA) * Math.sin((Math.PI * y) / ALTURA), 0.35);
  return Math.max(0.001, z) * janela;
};

// níveis pelos quantis dentro da lavoura: as 5 faixas ficam com áreas parecidas
const valores = [];
for (let y = 0; y <= ALTURA; y += 4)
  for (let x = 0; x <= LARGURA; x += 4) if (dentro([x, y])) valores.push(f(x, y));
valores.sort((a, b) => a - b);
const quantil = (q) => valores[Math.floor(q * (valores.length - 1))];
const niveis = [0.24, 0.46, 0.66, 0.84].map(quantil);

const faixas = niveis.map((nivel) =>
  costurar(isolinha(f, LARGURA, ALTURA, PASSO, nivel))
    .filter((l) => l.length > 24) // descarta pontinhos soltos
    .map((l) => {
      if (!eFechada(l)) throw new Error("curva de produção aberta: ajuste a janela");
      const { pts } = suavizar(l, 0.35);
      return caminho(pts, true);
    })
    .join(""),
);

// pin no ponto de maior produção dentro da lavoura
let pin = [0, 0];
let maior = -Infinity;
for (let y = 0; y <= ALTURA; y += 2)
  for (let x = 0; x <= LARGURA; x += 2)
    if (dentro([x, y]) && f(x, y) > maior) {
      maior = f(x, y);
      pin = [x, y];
    }

const dados = {
  largura: LARGURA,
  altura: ALTURA,
  contorno: caminho(contornoPts, true),
  faixas,
  pin,
};

const saida =
  "// Arquivo gerado por scripts/gerar-produtividade.mjs. Não editar à mão.\n\n" +
  `export const produtividade = ${JSON.stringify(dados)} as const;\n`;
writeFileSync(join(raiz, "components", "publico", "produtividade-dados.ts"), saida);
console.log(`produtividade: ${(saida.length / 1024).toFixed(1)} KB | pin em ${pin}`);
