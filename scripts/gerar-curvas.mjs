// Gera as curvas de nível (seção 4.7) uma única vez e grava os caminhos SVG em
// components/publico/curvas-dados.ts. Rodar com: node scripts/gerar-curvas.mjs
// O resultado é estático: as curvas não são recalculadas no navegador.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { aleatorio, caminho, costurar, eFechada, extremos, isolinha, suavizar } from "./relevo.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

// Relevo: soma de morros gaussianos levemente alongados.
function criarRelevo({ largura, altura, morros, semente }) {
  const r = aleatorio(semente);
  const lista = Array.from({ length: morros }, () => ({
    x: largura * (0.05 + r() * 0.9),
    y: altura * (0.05 + r() * 0.9),
    sx: largura * (0.07 + r() * 0.12),
    sy: altura * (0.14 + r() * 0.22),
    a: 0.6 + r() * 0.8,
    ang: r() * Math.PI,
  }));
  return (x, y) => {
    let z = 0;
    for (const m of lista) {
      const dx = x - m.x;
      const dy = y - m.y;
      const c = Math.cos(m.ang);
      const s = Math.sin(m.ang);
      const u = (dx * c + dy * s) / m.sx;
      const v = (-dx * s + dy * c) / m.sy;
      z += m.a * Math.exp(-(u * u + v * v) / 2);
    }
    // ondulação suave para tirar a cara de círculo perfeito
    z += 0.06 * Math.sin(x / 97) * Math.cos(y / 71);
    return z;
  };
}

function gerar({ largura, altura, morros, semente, niveis, passo = 10 }) {
  const f = criarRelevo({ largura, altura, morros, semente });
  const { min, max } = extremos(f, largura, altura, passo);
  const caminhos = [];
  for (let k = 1; k <= niveis; k++) {
    const nivel = min + ((max - min) * k) / (niveis + 1);
    for (const linha of costurar(isolinha(f, largura, altura, passo, nivel))) {
      // o fundo usa só as linhas que atravessam o quadro (os anéis de topo ficam de fora)
      if (linha.length < 4 || eFechada(linha)) continue;
      const { pts, fechada } = suavizar(linha);
      caminhos.push(caminho(pts, fechada));
    }
  }
  return { largura, altura, d: caminhos.join("") };
}

const conjuntos = {
  hero: gerar({ largura: 1440, altura: 760, morros: 9, semente: 31, niveis: 18, passo: 8 }),
  rodape: gerar({ largura: 1440, altura: 520, morros: 7, semente: 4459, niveis: 14, passo: 8 }),
  cartao: gerar({ largura: 800, altura: 800, morros: 4, semente: 2026, niveis: 14, passo: 8 }),
};

let saida =
  "// Arquivo gerado por scripts/gerar-curvas.mjs. Não editar à mão.\n\n" +
  "export const curvas = {\n";
for (const [nome, c] of Object.entries(conjuntos)) {
  saida += `  ${nome}: {\n    largura: ${c.largura},\n    altura: ${c.altura},\n    d: ${JSON.stringify(c.d)},\n  },\n`;
}
saida += "} as const;\n\nexport type ConjuntoCurvas = keyof typeof curvas;\n";

const destino = join(raiz, "components", "publico", "curvas-dados.ts");
writeFileSync(destino, saida);
for (const [nome, c] of Object.entries(conjuntos)) console.log(nome, `${(c.d.length / 1024).toFixed(1)} KB`);
