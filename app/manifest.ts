import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MoCCa · Monitoramento de colheita de café",
    short_name: "MoCCa",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F1E7",
    theme_color: "#4A2C1D",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
