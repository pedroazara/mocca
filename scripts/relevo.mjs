// Funções de relevo compartilhadas pelos geradores de SVG estático
// (gerar-curvas.mjs e gerar-produtividade.mjs). Nada aqui roda no navegador.

export function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Morro gaussiano alongado e girado.
export function morro({ x, y, sx, sy, a = 1, ang = 0 }) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return (px, py) => {
    const dx = px - x;
    const dy = py - y;
    const u = (dx * c + dy * s) / sx;
    const v = (-dx * s + dy * c) / sy;
    return a * Math.exp(-(u * u + v * v) / 2);
  };
}

// Marching squares: segmentos da isolinha no nível dado.
export function isolinha(f, largura, altura, passo, nivel) {
  const nx = Math.ceil(largura / passo) + 1;
  const ny = Math.ceil(altura / passo) + 1;
  const v = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = f(i * passo, j * passo);

  const segs = [];
  const interp = (x1, y1, a, x2, y2, b) => {
    const t = (nivel - a) / (b - a);
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const x = i * passo;
      const y = j * passo;
      const a = v[j * nx + i];
      const b = v[j * nx + i + 1];
      const c = v[(j + 1) * nx + i + 1];
      const d = v[(j + 1) * nx + i];
      const caso = (a > nivel ? 8 : 0) | (b > nivel ? 4 : 0) | (c > nivel ? 2 : 0) | (d > nivel ? 1 : 0);
      if (caso === 0 || caso === 15) continue;
      const topo = () => interp(x, y, a, x + passo, y, b);
      const dir = () => interp(x + passo, y, b, x + passo, y + passo, c);
      const base = () => interp(x, y + passo, d, x + passo, y + passo, c);
      const esq = () => interp(x, y, a, x, y + passo, d);
      const tabela = {
        1: [[esq, base]], 2: [[base, dir]], 3: [[esq, dir]], 4: [[topo, dir]],
        5: [[esq, topo], [base, dir]], 6: [[topo, base]], 7: [[esq, topo]],
        8: [[esq, topo]], 9: [[topo, base]], 10: [[esq, base], [topo, dir]],
        11: [[topo, dir]], 12: [[esq, dir]], 13: [[base, dir]], 14: [[esq, base]],
      };
      for (const [p, q] of tabela[caso]) segs.push([p(), q()]);
    }
  }
  return segs;
}

// Junta segmentos que compartilham pontas em polilinhas contínuas.
export function costurar(segs) {
  const chave = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const mapa = new Map();
  segs.forEach((s, idx) => {
    for (const p of s) {
      const k = chave(p);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(idx);
    }
  });
  const usado = new Uint8Array(segs.length);
  const linhas = [];
  for (let i = 0; i < segs.length; i++) {
    if (usado[i]) continue;
    usado[i] = 1;
    const linha = [segs[i][0], segs[i][1]];
    for (const sentido of [1, -1]) {
      for (;;) {
        const ponta = sentido === 1 ? linha[linha.length - 1] : linha[0];
        const prox = (mapa.get(chave(ponta)) || []).find((k) => !usado[k]);
        if (prox === undefined) break;
        usado[prox] = 1;
        const [p, q] = segs[prox];
        const novo = chave(p) === chave(ponta) ? q : p;
        if (sentido === 1) linha.push(novo);
        else linha.unshift(novo);
      }
    }
    linhas.push(linha);
  }
  return linhas;
}

export function chaikin(pts, fechada) {
  const out = [];
  const n = pts.length;
  const lim = fechada ? n : n - 1;
  if (!fechada) out.push(pts[0]);
  for (let i = 0; i < lim; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    out.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]]);
    out.push([0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
  }
  if (!fechada) out.push(pts[n - 1]);
  return out;
}

export function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let max = 0;
  let idx = 0;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

export function eFechada(linha) {
  return (
    linha.length > 3 && Math.hypot(linha[0][0] - linha.at(-1)[0], linha[0][1] - linha.at(-1)[1]) < 0.01
  );
}

// Suaviza e simplifica uma polilinha; devolve os pontos.
export function suavizar(linha, eps = 0.45) {
  const fechada = eFechada(linha);
  let pts = fechada ? linha.slice(0, -1) : linha;
  pts = chaikin(chaikin(pts, fechada), fechada);
  if (!fechada) return { pts: rdp(pts, eps), fechada };
  // num laço o início e o fim coincidem: divide no ponto mais distante do início
  let k = 0;
  let longe = -1;
  pts.forEach(([x, y], i) => {
    const d = Math.hypot(x - pts[0][0], y - pts[0][1]);
    if (d > longe) {
      longe = d;
      k = i;
    }
  });
  const ida = rdp(pts.slice(0, k + 1), eps);
  const volta = rdp([...pts.slice(k), pts[0]], eps);
  return { pts: [...ida.slice(0, -1), ...volta.slice(0, -1)], fechada };
}

// Caminho SVG compacto (coordenadas inteiras, comandos relativos).
export function caminho(pts, fechada) {
  let d = `M${Math.round(pts[0][0])} ${Math.round(pts[0][1])}`;
  let [px, py] = [Math.round(pts[0][0]), Math.round(pts[0][1])];
  for (const p of pts.slice(1)) {
    const x = Math.round(p[0]);
    const y = Math.round(p[1]);
    if (x === px && y === py) continue;
    d += `l${x - px} ${y - py}`;
    [px, py] = [x, y];
  }
  return fechada ? d + "z" : d;
}

export function extremos(f, largura, altura, passo) {
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y <= altura; y += passo)
    for (let x = 0; x <= largura; x += passo) {
      const z = f(x, y);
      if (z < min) min = z;
      if (z > max) max = z;
    }
  return { min, max };
}
