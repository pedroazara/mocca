// Foto e LinkedIn da pessoa na página Equipe do site. A foto é sempre um JPEG 4:3
// recortado no navegador: o arquivo original (e o GPS da câmera) não sai do aparelho.

const LARGURA_FOTO = 960;
const PROPORCAO_FOTO = 4 / 3;

// Aceita o link como a pessoa colar. Devolve null se não for do LinkedIn.
export function normalizarLinkedin(valor: string) {
  const t = valor.trim();
  try {
    const url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (url.host !== "linkedin.com" && !url.host.endsWith(".linkedin.com")) return null;
    if (url.pathname.length < 2) return null;
    url.protocol = "https:";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

// O servidor só guarda JPEG: em base64, todo JPEG começa com "/9j/".
export const ehJpegBase64 = (base64: string) => /^\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(base64);

// Só no navegador. `posicao` (0 a 100) escolhe o trecho da foto que fica no 4:3,
// como o object-position da prévia. Devolve o JPEG em base64.
export function recortarFoto(img: HTMLImageElement, posicao: number) {
  const { naturalWidth: largura, naturalHeight: altura } = img;
  const recorteL = Math.min(largura, altura * PROPORCAO_FOTO);
  const recorteA = recorteL / PROPORCAO_FOTO;
  const escala = Math.min(1, LARGURA_FOTO / recorteL);
  const tela = document.createElement("canvas");
  tela.width = Math.round(recorteL * escala);
  tela.height = Math.round(recorteA * escala);
  const ctx = tela.getContext("2d")!;
  ctx.fillStyle = "#fff"; // PNG transparente ficaria preto no JPEG
  ctx.fillRect(0, 0, tela.width, tela.height);
  const x = ((largura - recorteL) * posicao) / 100;
  const y = ((altura - recorteA) * posicao) / 100;
  ctx.drawImage(img, x, y, recorteL, recorteA, 0, 0, tela.width, tela.height);
  return tela.toDataURL("image/jpeg", 0.85).split(",")[1];
}
