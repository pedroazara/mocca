import { imagemOg, tamanhoOg } from "@/lib/og";

export const alt = "Contato · MoCCa";
export const size = tamanhoOg;
export const contentType = "image/png";

export default function Imagem() {
  return imagemOg("Fale com a equipe");
}
