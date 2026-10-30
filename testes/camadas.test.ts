// Pilha de camadas: a projeção dos caminhos do mapa e o enquadramento.

import { describe, expect, it } from "vitest";
import { montarPilha } from "@/lib/camadas";
import { gerarMapa } from "@/lib/talhoes";

const mapa = gerarMapa({ largura: 240, altura: 150, faixas: 3, porFaixa: [3, 4], semente: 77, inclinacao: 16, curvatura: 6 });
const pilha = montarPilha(mapa);
const pares = (d: string) => [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(([, a, b]) => [+a, +b]);

describe("pilha de camadas", () => {
  it("projeta cada par de coordenadas, sem perder nem sobrar nenhum", () => {
    expect(pares(pilha.contorno)).toHaveLength(pares(mapa.contorno).length);
    pilha.talhoes.forEach((t, i) => expect(pares(t.d)).toHaveLength(pares(mapa.talhoes[i].d).length));
    // os comandos continuam os mesmos (só os números mudam)
    expect(pilha.contorno.replace(/[-\d. ]/g, "")).toBe(mapa.contorno.replace(/[-\d. ]/g, ""));
  });

  it("cabe no quadro, com a placa de baixo e a espessura", () => {
    const xs = pares(pilha.contorno).map(([x]) => x);
    const ys = pares(pilha.contorno).map(([, y]) => y);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(pilha.largura);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys) + pilha.deslocamentos[3] + pilha.espessura).toBeLessThanOrEqual(pilha.altura);
  });

  it("separa mais a colheita das outras camadas e põe os rótulos em ordem", () => {
    const [topo, a, b, c] = pilha.deslocamentos;
    expect(topo).toBe(0);
    expect(a - topo).toBeGreaterThan(b - a);
    expect(c - b).toBe(b - a);
    expect([...pilha.centros].sort((x, y) => x - y)).toEqual(pilha.centros);
    for (const p of pilha.centros) {
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(100);
    }
  });

  it("marca um talhão da faixa mais baixa", () => {
    expect(mapa.talhoes[7].nivel).toBe(1);
  });
});
