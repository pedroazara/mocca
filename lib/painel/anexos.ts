// Anexos da entrega da semana: fotos e PDFs. A foto é reduzida no navegador e
// vira JPEG: o arquivo original (e o GPS da câmera) não sai do aparelho, e o envio
// fica leve mesmo no 4G do campo. A miniatura vai junto, para a grade não baixar
// a foto inteira. O PDF vai como está, até 4 MB (cabe numa requisição da Vercel).

export const LADO_FOTO = 1600;
export const LADO_MINIATURA = 640;
// os limites das colunas no banco
export const MAX_FOTO_BYTES = 2 * 1024 * 1024;
export const MAX_MINIATURA_BYTES = 256 * 1024;
export const MAX_PDF_BYTES = 4 * 1024 * 1024;
export const MAX_ANEXOS_POR_ENTREGA = 40;

export const ehPdf = (f: { type: string; name: string }) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
export const ehImagem = (f: { type: string; name: string }) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name);

// Todo PDF começa com "%PDF-".
export const comecaComoPdf = (b: Uint8Array) =>
  b.length > 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d;

// Nome que vai para o banco e para o download: sem pasta, sem caracteres de
// controle, com a extensão certa.
export function nomeDoArquivo(nome: string, extensao: "pdf" | "jpg") {
  const base = (nome.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .trim()
    .slice(0, 190);
  return `${base || "arquivo"}.${extensao}`;
}

// "850 KB", "1,2 MB", "4 MB"
export function tamanhoArquivo(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${String(Math.round((bytes / (1024 * 1024)) * 10) / 10).replace(".", ",")} MB`;
}

// Medidas da imagem reduzida: o lado maior vai até `lado`, sem ampliar.
export function medidasReduzidas(largura: number, altura: number, lado: number) {
  const escala = Math.min(1, lado / Math.max(largura, altura));
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}

// Quantos bytes o texto em base64 representa.
export function bytesDoBase64(base64: string) {
  const sobra = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - sobra;
}

// Só no navegador. O navegador já aplica a rotação da câmera (EXIF) ao desenhar.
async function abrir(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// JPEG em base64 com o lado maior até `lado`. Se passar do limite, baixa a
// qualidade até caber.
function emJpeg(img: HTMLImageElement, lado: number, maxBytes: number) {
  const { largura, altura } = medidasReduzidas(img.naturalWidth, img.naturalHeight, lado);
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext("2d")!;
  ctx.fillStyle = "#fff"; // PNG transparente ficaria preto no JPEG
  ctx.fillRect(0, 0, largura, altura);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, largura, altura);
  for (const qualidade of [0.85, 0.75, 0.65, 0.5]) {
    const base64 = tela.toDataURL("image/jpeg", qualidade).split(",")[1] ?? "";
    if (base64 && bytesDoBase64(base64) <= maxBytes) return base64;
  }
  throw new Error("foto grande demais");
}

// Lança erro quando o navegador não consegue abrir a imagem (HEIC no Chrome, por exemplo).
export async function prepararFoto(arquivo: File) {
  const img = await abrir(arquivo);
  return {
    nome: nomeDoArquivo(arquivo.name, "jpg"),
    foto: emJpeg(img, LADO_FOTO, MAX_FOTO_BYTES),
    miniatura: emJpeg(img, LADO_MINIATURA, MAX_MINIATURA_BYTES),
  };
}
