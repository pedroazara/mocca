// Gera public/email/cabecalho.png, a faixa do topo dos e-mails: fundo espresso,
// curvas de nível do rodapé do site e a logo do site para fundo escuro.
// O Gmail não mostra SVG nem imagem de fundo, então a faixa é um PNG só, opaco
// (no modo escuro do celular, transparência some ou inverte), em 2x para telas
// densas. Os cantos de cima já vêm arredondados sobre o creme do fundo do e-mail.
// Rodar com: node scripts/gerar-cabecalho-email.mjs
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const LARGURA = 1200; // 600 px no e-mail
const ALTURA = 224;
const RAIO = 32;
const ALTURA_LOGO = 84;

// As curvas vêm de curvas-dados.ts (gerado por gerar-curvas.mjs): o conjunto do rodapé.
const dados = readFileSync(join(raiz, "components", "publico", "curvas-dados.ts"), "utf8");
const rodape = dados.match(/rodape:\s*\{\s*largura:\s*(\d+),\s*altura:\s*(\d+),\s*d:\s*"([^"]+)"/);
if (!rodape) throw new Error("conjunto rodape não encontrado em curvas-dados.ts");
const [, larguraCurvas, alturaCurvas, caminho] = rodape;

// Enquadramento "slice", como no site: a escala cobre a faixa toda e corta o resto.
const escala = Math.max(LARGURA / larguraCurvas, ALTURA / alturaCurvas);
const dx = (LARGURA - larguraCurvas * escala) / 2;
const dy = (ALTURA - alturaCurvas * escala) / 2;

const fundo = `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}">
  <rect width="100%" height="100%" fill="#F6F1E7"/>
  <clipPath id="faixa"><rect width="${LARGURA}" height="${ALTURA + RAIO}" rx="${RAIO}"/></clipPath>
  <g clip-path="url(#faixa)">
    <rect width="${LARGURA}" height="${ALTURA + RAIO}" fill="#4A2C1D"/>
    <path d="${caminho}" transform="translate(${dx} ${dy}) scale(${escala})" fill="none"
      stroke="#F6F1E7" stroke-opacity="0.13" stroke-width="${2 / escala}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

// Logo do site para fundo escuro (mocca-site-*), a mesma do rodapé: vinco e contorno do
// pin em creme, sem as curvas da oficial, que viram ruído nesse tamanho. Montada como no
// LogoHorizontal: o símbolo vai sobre o "MoCCa" na posição de .logo-grao (globals.css).
const DENSIDADE = 72 * 4;
const pastaLogo = join(raiz, "public", "logo");
const texto = sharp(join(pastaLogo, "mocca-site-texto-fundo-escuro.svg"), { density: DENSIDADE });
const { width: larguraTexto, height: alturaTexto } = await texto.metadata();
const simbolo = await sharp(join(pastaLogo, "mocca-site-simbolo-fundo-escuro.svg"), { density: DENSIDADE })
  .resize({ width: Math.round(larguraTexto * 0.18463), height: Math.round(alturaTexto * 0.53846) })
  .toBuffer();
const montada = await texto
  .composite([{ input: simbolo, left: Math.round(larguraTexto * 0.09226), top: Math.round(alturaTexto * 0.23077) }])
  .png()
  .toBuffer();
const logo = await sharp(montada).trim().resize({ height: ALTURA_LOGO }).toBuffer();

mkdirSync(join(raiz, "public", "email"), { recursive: true });
await sharp(Buffer.from(fundo))
  .composite([{ input: logo, left: 64, top: Math.round((ALTURA - ALTURA_LOGO) / 2) }])
  .flatten({ background: "#4A2C1D" })
  .png({ palette: true, colors: 128, effort: 10 })
  .toFile(join(raiz, "public", "email", "cabecalho.png"));
