import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // banco embutido do modo local (WASM) e os drivers do Postgres e do SMTP ficam fora do bundle
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "nodemailer"],
  experimental: {
    // o JSON do Trello (já enxugado no navegador) pode passar de 1 MB
    serverActions: { bodySizeLimit: "8mb" },
    // CSS no próprio HTML: sem requisição bloqueante antes da primeira pintura
    inlineCss: true,
  },
  async headers() {
    return [
      {
        // o painel nunca é indexado (seção 3.2)
        source: "/painel/:caminho*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/entrar",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:caminho*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
