// Geração determinística da grade de talhões (seção 4.7). Roda no servidor durante
// o build; o HTML final traz o SVG pronto. Os níveis são ilustrativos.

export type Ponto = [number, number];

export type Nivel = 1 | 2 | 3 | 4 | 5;

export type Talhao = {
  id: number;
  numero: string;
  d: string;
  centro: Ponto;
  nivel: Nivel;
  // centro longe da borda da fazenda: dá para escrever o número sem cortar
  rotulavel: boolean;
};

export type Mapa = {
  largura: number;
  altura: number;
  margem: number;
  angulo: number;
  talhoes: Talhao[];
  contorno: string;
};

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

const n1 = (v: number) => Math.round(v * 10) / 10;

function poligono(pts: Ponto[]) {
  return "M" + pts.map(([x, y]) => `${n1(x)} ${n1(y)}`).join("L") + "Z";
}

// Curva fechada suave (Catmull-Rom convertida em Bézier cúbica).
function curvaFechada(pts: Ponto[]) {
  const n = pts.length;
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Ponto = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Ponto = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return d + "Z";
}

export function gerarMapa({
  largura,
  altura,
  faixas,
  porFaixa,
  semente,
  inclinacao = 30,
  curvatura = 14,
  angulo = 0,
}: {
  largura: number;
  altura: number;
  faixas: number;
  porFaixa: [number, number];
  semente: number;
  inclinacao?: number;
  curvatura?: number;
  angulo?: number;
}): Mapa {
  const r = aleatorio(semente);

  // faixas com alturas diferentes; as divisas são levemente inclinadas e curvas,
  // como carreadores que acompanham o terreno
  const pesos = Array.from({ length: faixas }, () => 0.75 + r() * 0.5);
  const soma = pesos.reduce((a, b) => a + b, 0);
  const ys = [0];
  for (const p of pesos) ys.push(ys[ys.length - 1] + (p / soma) * altura);
  const desl = ys.map(() => [(r() - 0.5) * inclinacao, (r() - 0.5) * inclinacao]);
  const arco = ys.map(() => (r() - 0.5) * 2 * curvatura);
  const yEm = (k: number, x: number) =>
    ys[k] + desl[k][0] + (desl[k][1] - desl[k][0]) * (x / largura) + arco[k] * Math.sin((Math.PI * x) / largura);

  const amostrar = (k: number, xa: number, xb: number) => {
    const pts: Ponto[] = [];
    for (let s = 0; s <= 6; s++) {
      const x = xa + ((xb - xa) * s) / 6;
      pts.push([x, yEm(k, x)]);
    }
    return pts;
  };

  const brutos: { pts: Ponto[]; centro: Ponto; valor: number }[] = [];
  for (let b = 0; b < faixas; b++) {
    const n = porFaixa[0] + Math.floor(r() * (porFaixa[1] - porFaixa[0] + 1));
    const px = Array.from({ length: n }, () => 0.7 + r() * 0.6);
    const sx = px.reduce((a, c) => a + c, 0);
    const xs = [-largura * 0.04];
    for (const p of px) xs.push(xs[xs.length - 1] + (p / sx) * largura * 1.08);
    const jit = () => (r() - 0.5) * inclinacao * 1.8;
    const topo = xs.map((x, i) => (i === 0 || i === n ? x : x + jit()));
    const base = xs.map((x, i) => (i === 0 || i === n ? x : x + jit()));
    for (let i = 0; i < n; i++) {
      const cima = amostrar(b, topo[i], topo[i + 1]);
      const baixo = amostrar(b + 1, base[i + 1], base[i]);
      const pts: Ponto[] = [...cima, ...baixo];
      const centro: Ponto = [
        (topo[i] + topo[i + 1] + base[i] + base[i + 1]) / 4,
        (yEm(b, (topo[i] + topo[i + 1]) / 2) + yEm(b + 1, (base[i] + base[i + 1]) / 2)) / 2,
      ];
      const u = centro[0] / largura;
      const v = centro[1] / altura;
      // campo suave (manchas de produção) + ruído: só para a ilustração parecer real
      const valor =
        0.35 * Math.sin(2.3 * u + 0.9) * Math.cos(2.0 * v - 0.4) + 0.25 * u - 0.1 * v + 0.3 * (r() - 0.5);
      brutos.push({ pts, centro, valor });
    }
  }

  // níveis por posição na ordem, para que as 5 faixas da legenda apareçam
  const ordem = brutos.map((t, i) => [t.valor, i] as const).sort((a, b) => a[0] - b[0]);
  const nivelDe = new Map<number, Nivel>();
  ordem.forEach(([, i], pos) => nivelDe.set(i, (1 + Math.floor((pos / ordem.length) * 5)) as Nivel));

  // contorno orgânico da fazenda: superelipse com bordas irregulares
  const cx = largura / 2;
  const cy = altura / 2;
  const e = 3.6;

  const talhoes: Talhao[] = brutos.map((t, i) => ({
    id: i,
    numero: String(i + 1).padStart(2, "0"),
    d: poligono(t.pts),
    centro: [n1(t.centro[0]), n1(t.centro[1])],
    nivel: nivelDe.get(i)!,
    rotulavel:
      Math.pow(Math.abs((t.centro[0] - cx) / (largura / 2)), e) +
        Math.pow(Math.abs((t.centro[1] - cy) / (altura / 2)), e) <
      0.62,
  }));

  const pontosContorno: Ponto[] = [];
  const fase = r() * Math.PI * 2;
  for (let k = 0; k < 32; k++) {
    const ang = (k / 32) * Math.PI * 2;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const fx = Math.sign(c) * Math.pow(Math.abs(c), 2 / e);
    const fy = Math.sign(s) * Math.pow(Math.abs(s), 2 / e);
    const irreg = 0.95 + 0.04 * Math.sin(3 * ang + fase) + 0.02 * Math.sin(7 * ang + 2 * fase);
    pontosContorno.push([cx + fx * (largura / 2) * irreg, cy + fy * (altura / 2) * irreg]);
  }

  const margem = Math.ceil((Math.max(largura, altura) * Math.abs(Math.sin((angulo * Math.PI) / 180))) / 2) + 10;

  return {
    largura,
    altura,
    margem,
    angulo,
    talhoes,
    contorno: curvaFechada(pontosContorno),
  };
}

// Converte um ponto do mapa (já considerando a rotação) em % da área do SVG,
// para posicionar cartões HTML por cima da ilustração.
export function posicaoNaTela(m: Mapa, [x, y]: Ponto) {
  const cx = m.largura / 2;
  const cy = m.altura / 2;
  const a = (m.angulo * Math.PI) / 180;
  const rx = cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a);
  const ry = cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a);
  return {
    esquerda: ((rx + m.margem) / (m.largura + 2 * m.margem)) * 100,
    topo: ((ry + m.margem) / (m.altura + 2 * m.margem)) * 100,
  };
}
