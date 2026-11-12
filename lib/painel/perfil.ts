// Foto e LinkedIn da pessoa na página Equipe do site, e o WhatsApp de quem atende
// pelo site. A foto é sempre um JPEG 4:3 recortado no navegador: o arquivo original
// (e o GPS da câmera) não sai do aparelho.

import { formatarTelefone, soDigitos } from "@/lib/validacao/contato";

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

// WhatsApp de contato no site. Aceita o número como a pessoa digitar, com ou sem
// +55, e devolve só dígitos com 55 e DDD (o formato do wa.me). Devolve null se
// não for um telefone brasileiro com DDD.
export function normalizarWhatsapp(valor: string) {
  if (/^\s*\+(?!\s*55)/.test(valor)) return null; // código de outro país
  const d = soDigitos(valor).replace(/^0+/, "");
  const n = d.length === 12 || d.length === 13 ? d : `55${d}`;
  return /^55[1-9][0-9]{9,10}$/.test(n) ? n : null;
}

// Como o número guardado aparece na tela: (35) 99999-8888.
export const formatarWhatsapp = (numero: string) => formatarTelefone(numero.slice(2));

// Máscara do campo no painel. Quem cola o número inteiro, com +55, fica só com DDD e número.
export function mascaraWhatsapp(valor: string) {
  const d = soDigitos(valor);
  return formatarTelefone(d.length > 11 && d.startsWith("55") ? d.slice(2) : d);
}

// A conversa abre com uma primeira mensagem, para a equipe saber de onde a pessoa veio.
export const MENSAGEM_WHATSAPP = "Olá! Vi o site do MoCCa e quero saber mais.";
export const linkWhatsapp = (numero: string, mensagem = MENSAGEM_WHATSAPP) =>
  `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;

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
