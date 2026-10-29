import { imagemOg, tamanhoOg } from "@/lib/og";

export const alt = "Como funciona · MoCCa";
export const size = tamanhoOg;
export const contentType = "image/png";

export default function Imagem() {
  return imagemOg("Como o MoCCa mede a colheita");
}
