import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Só as páginas públicas (seção 6.8).
export default function sitemap(): MetadataRoute.Sitemap {
  const paginas = ["", "/como-funciona", "/equipe", "/contato", "/privacidade"];
  return paginas.map((p) => ({
    url: `${site}${p}`,
    changeFrequency: "monthly",
    priority: p === "" ? 1 : 0.7,
  }));
}
