import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { curvas } from "@/components/publico/curvas-dados";
import { produtividade } from "@/components/publico/produtividade-dados";
import { marca, temaClaro } from "./tokens";

// Imagem Open Graph 1200x630 (seção 6.8): fundo creme, curvas de nível,
// logo horizontal e o título da página em Sora 700 espresso.

export const tamanhoOg = { width: 1200, height: 630 };

// os 5 tons de --talhao-1..5 no tema claro, já resolvidos (aqui não há CSS)
const tons = [temaClaro.linha, "#D2A47B", marca.caramelo, marca.torra, marca.espresso];

// O mesmo mapa de produtividade do hero, com as cores escritas no SVG. O pin vai
// numa imagem separada por cima (o renderizador não desenha imagem dentro de SVG).
const MAPA = { direita: 40, topo: 116, largura: 520 };
const escalaMapa = MAPA.largura / produtividade.largura;
function svgMapa() {
  const { largura, altura, contorno, faixas, pin } = produtividade;
  const manchas = faixas.map((d, i) => `<path d="${d}" fill="${tons[i + 1]}" fill-rule="evenodd"/>`).join("");
  const divisas = faixas.map((d) => `<path d="${d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}">
    <defs><clipPath id="l"><path d="${contorno}"/></clipPath></defs>
    <g clip-path="url(#l)">
      <rect width="${largura}" height="${altura}" fill="${tons[0]}"/>${manchas}
      <g fill="none" stroke="${marca.creme}" stroke-opacity="0.6" stroke-width="1.2">${divisas}</g>
    </g>
    <path d="${contorno}" fill="none" stroke="${temaClaro.texto}" stroke-opacity="0.45" stroke-width="1.5"/>
    <circle cx="${pin[0]}" cy="${pin[1]}" r="4.5" fill="${temaClaro.texto}" stroke="${marca.creme}" stroke-width="2"/>
  </svg>`;
}

function svgCurvas() {
  const c = curvas.hero;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${c.largura} ${c.altura}" width="1200" height="630" preserveAspectRatio="xMidYMid slice"><path d="${c.d}" fill="none" stroke="${marca.caramelo}" stroke-opacity="0.28" stroke-width="1.6"/></svg>`;
}

const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

export async function imagemOg(titulo: string) {
  const raiz = process.cwd();
  const [sora, mono, logo, simbolo] = await Promise.all([
    readFile(join(raiz, "node_modules/@fontsource/sora/files/sora-latin-700-normal.woff")),
    readFile(join(raiz, "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff")),
    readFile(join(raiz, "public/logo/mocca-logo-horizontal.svg"), "utf8"),
    readFile(join(raiz, "public/logo/mocca-simbolo.svg"), "utf8"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: marca.creme,
          fontFamily: "Sora",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUri(svgCurvas())} width={1200} height={630} alt="" style={{ position: "absolute", inset: 0 }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUri(svgMapa())}
          width={MAPA.largura}
          height={Math.round(produtividade.altura * escalaMapa)}
          alt=""
          style={{ position: "absolute", right: MAPA.direita, top: MAPA.topo }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUri(simbolo)}
          width={26}
          height={36}
          alt=""
          style={{
            position: "absolute",
            left: 1200 - MAPA.direita - MAPA.largura + produtividade.pin[0] * escalaMapa - 13,
            top: MAPA.topo + produtividade.pin[1] * escalaMapa - 40,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", padding: "52px 64px", width: 700, height: "100%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUri(logo)} width={287} height={120} alt="MoCCa" style={{ marginLeft: -28 }} />
          <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
            <div
              style={{
                fontSize: titulo.length > 28 ? 60 : 72,
                lineHeight: 1.06,
                letterSpacing: "-0.02em",
                color: marca.espresso,
                fontWeight: 700,
              }}
            >
              {titulo}
            </div>
          </div>
          <div
            style={{
              fontFamily: "JetBrains Mono",
              fontSize: 20,
              letterSpacing: "0.08em",
              color: temaClaro.texto2,
              textTransform: "uppercase",
            }}
          >
            Monitoramento de colheita de café · 21°14′S 44°59′W
          </div>
        </div>
      </div>
    ),
    {
      ...tamanhoOg,
      fonts: [
        { name: "Sora", data: sora, weight: 700, style: "normal" },
        { name: "JetBrains Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}
