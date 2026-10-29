// Gera favicon.ico (16, 32, 48), icon.png (512) e apple-icon.png (180) a partir
// de assets/logo/mocca-icone-app.png (seção 4.2). Rodar com: node scripts/gerar-icones.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origem = join(raiz, "assets", "logo", "mocca-icone-app.png");
const png = (tamanho) => sharp(origem).resize(tamanho, tamanho, { kernel: "lanczos3" }).png().toBuffer();

// paleta reduzida: o ícone tem poucas cores e é pedido cedo pelo navegador
await sharp(origem).resize(512, 512).png({ palette: true, colors: 64, effort: 10 }).toFile(join(raiz, "app", "icon.png"));
// o iOS aplica a própria máscara arredondada: preenche os cantos com espresso
await sharp(origem).resize(180, 180).flatten({ background: "#4A2C1D" }).png({ palette: true, colors: 64, effort: 10 }).toFile(join(raiz, "app", "apple-icon.png"));

// ICO com imagens PNG embutidas (aceito por todos os navegadores atuais)
const tamanhos = [16, 32, 48];
const imagens = await Promise.all(tamanhos.map(png));
const cabecalho = Buffer.alloc(6);
cabecalho.writeUInt16LE(0, 0);
cabecalho.writeUInt16LE(1, 2);
cabecalho.writeUInt16LE(tamanhos.length, 4);
let deslocamento = 6 + 16 * tamanhos.length;
const entradas = tamanhos.map((t, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(t, 0);
  e.writeUInt8(t, 1);
  e.writeUInt8(0, 2);
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(imagens[i].length, 8);
  e.writeUInt32LE(deslocamento, 12);
  deslocamento += imagens[i].length;
  return e;
});
writeFileSync(join(raiz, "app", "favicon.ico"), Buffer.concat([cabecalho, ...entradas, ...imagens]));
console.log("ícones gerados em app/");
