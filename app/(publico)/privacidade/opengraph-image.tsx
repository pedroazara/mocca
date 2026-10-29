import { imagemOg, tamanhoOg } from "@/lib/og";

export const alt = "Privacidade · MoCCa";
export const size = tamanhoOg;
export const contentType = "image/png";

export default function Imagem() {
  return imagemOg("Como cuidamos dos seus dados");
}
