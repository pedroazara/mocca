import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Public_Sans, Sora } from "next/font/google";
import { scriptTema } from "@/lib/tema";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  // o texto principal (Public Sans) chega primeiro; os títulos trocam de fonte logo depois
  preload: false,
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  // só aparece em rótulos pequenos: não disputa a banda com o texto principal
  preload: false,
});

const urlDoSite = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(urlDoSite),
  title: {
    default: "MoCCa · Monitoramento de colheita de café",
    template: "%s · MoCCa",
  },
  description:
    "Projeto de estudantes da UFLA que mede o café enquanto ele é colhido e guarda de onde saiu cada volume, talhão por talhão.",
  applicationName: "MoCCa",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "MoCCa",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F1E7" },
    { media: "(prefers-color-scheme: dark)", color: "#1A120D" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${sora.variable} ${publicSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* aplica o tema salvo antes da pintura, para não piscar (seção 4.4) */}
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
