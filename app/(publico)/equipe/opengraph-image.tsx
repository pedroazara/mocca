import { imagemOg, tamanhoOg } from "@/lib/og";

export const alt = "Equipe · MoCCa";
export const size = tamanhoOg;
export const contentType = "image/png";

export default function Imagem() {
  return imagemOg("Quem está construindo");
}
