// Espelho em TypeScript dos tokens de app/globals.css (seção 4.4).
// Use para gráficos e imagens geradas no servidor (Open Graph), onde não há CSS.

export const marca = {
  espresso: "#4A2C1D",
  caramelo: "#B9733F",
  carameloTexto: "#96592A",
  torra: "#8A5A3B",
  creme: "#F6F1E7",
  vermelho: "#771900",
} as const;

export const temaClaro = {
  fundo: "#F6F1E7",
  superficie: "#FFFCF7",
  superficie2: "#EFE6DA",
  linha: "#E3D6C5",
  texto: "#2B1A11",
  texto2: "#6E5444",
  link: "#96592A",
  foco: "#B9733F",
  botaoPrimario: "#4A2C1D",
  botaoPrimarioTexto: "#F6F1E7",
  botaoPrimarioHover: "#5E3A27",
  ok: "#3F7A4A",
  okFundo: "#E1EEDF",
  alerta: "#8F6210",
  alertaFundo: "#F5E8C8",
  erro: "#A2412F",
  erroFundo: "#F5DED7",
  info: "#2F5F86",
  infoFundo: "#DDE8F1",
} as const;

export const temaEscuro = {
  fundo: "#1A120D",
  superficie: "#241912",
  superficie2: "#2F2118",
  linha: "#3B2B21",
  texto: "#F3E9DC",
  texto2: "#B79E8A",
  link: "#D49360",
  foco: "#D49360",
  caramelo: "#D49360",
  botaoPrimario: "#D49360",
  botaoPrimarioTexto: "#1A120D",
  botaoPrimarioHover: "#E0A676",
  ok: "#8CC795",
  okFundo: "#20311F",
  alerta: "#E3B862",
  alertaFundo: "#362B14",
  erro: "#E58B78",
  erroFundo: "#3A211B",
  info: "#8DB8DD",
  infoFundo: "#1C2A36",
} as const;

export const etiquetas = {
  Entregas: "et-entregas",
  "Validação do Produto": "et-validacao",
  Técnico: "et-tecnico",
  Negócio: "et-negocio",
  Marketing: "et-marketing",
} as const;

// Cores das pessoas (seção 9.8). Texto creme sobre todas com contraste >= 4,5:1.
export const coresPessoas = {
  gabriel: "#2F5F86",
  pedro: "#4A2C1D",
  marcos: "#7A3F7A",
  lucas: "#3F6B4A",
  henrique: "#8F4A1F",
  leomar: "#5A5048",
} as const;
