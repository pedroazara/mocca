import { imagemOg, tamanhoOg } from "@/lib/og";

export const alt = "MoCCa · Monitoramento de colheita de café";
export const size = tamanhoOg;
export const contentType = "image/png";

export default function Imagem() {
  return imagemOg("Cada saca tem um endereço.");
}
