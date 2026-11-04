// IP de quem chamou e a chave do limite de envios do formulário de contato.
// Sem nada de servidor: a rota e os testes usam o mesmo código.

// O IP como a Vercel informa: x-real-ip, ou o primeiro de x-forwarded-for (a
// Vercel sobrescreve esse cabeçalho, então o cliente não consegue forjá-lo).
// Cabeçalhos que o próprio cliente manda e ninguém confere, como o
// cf-connecting-ip sem a Cloudflare na frente, não contam (DUVIDAS 28).
export function ipDaRequisicao(h: Headers) {
  return (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "").trim();
}

// Chave do limite: o IPv4 inteiro, ou o prefixo /64 do IPv6. Uma casa ou um
// celular costuma receber um /64 inteiro e pode trocar de endereço dentro dele.
export function chaveDoIp(ip: string) {
  const limpo = ip.trim().toLowerCase().replace(/%.*$/, "").replace(/^\[|\]$/g, "");
  const v4 = limpo.match(/^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) return v4[1];
  if (!limpo.includes(":")) return limpo;
  const [cabeca, cauda = ""] = limpo.split("::");
  const a = cabeca ? cabeca.split(":") : [];
  const b = cauda ? cauda.split(":") : [];
  const zeros = limpo.includes("::") ? Array<string>(Math.max(0, 8 - a.length - b.length)).fill("0") : [];
  const grupos = [...a, ...zeros, ...b].map((g) => g.replace(/^0+(?=.)/, ""));
  return `${grupos.slice(0, 4).join(":")}::/64`;
}
