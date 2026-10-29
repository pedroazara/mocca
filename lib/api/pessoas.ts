// Resolução de pessoa na API do Claude (seção 11.2): por id, e-mail ou apelido,
// sem diferenciar maiúsculas e acentos. Ambíguo ou inexistente vira erro 422
// com a lista de pessoas válidas.

import { normalizar } from "@/lib/painel/trello";

export type PessoaApi = { id: string; nome: string; apelido: string | null; email: string; frente: string | null };

export type Resolucao =
  | { ok: true; pessoa: PessoaApi }
  | { ok: false; motivo: "inexistente" | "ambigua"; candidatas: PessoaApi[] };

export function resolverPessoa(ref: string, pessoas: PessoaApi[]): Resolucao {
  const r = normalizar(ref ?? "");
  if (!r) return { ok: false, motivo: "inexistente", candidatas: [] };
  const exata = pessoas.find((p) => p.id === ref.trim() || normalizar(p.email) === r);
  if (exata) return { ok: true, pessoa: exata };
  const porApelido = pessoas.filter((p) => p.apelido && normalizar(p.apelido) === r);
  if (porApelido.length === 1) return { ok: true, pessoa: porApelido[0] };
  if (porApelido.length > 1) return { ok: false, motivo: "ambigua", candidatas: porApelido };
  // nome completo, com ou sem o "Prof."
  const semTitulo = (nome: string) => normalizar(nome.replace(/^Profa?\.\s*/i, ""));
  const porNome = pessoas.filter((p) => normalizar(p.nome) === r || semTitulo(p.nome) === r);
  if (porNome.length === 1) return { ok: true, pessoa: porNome[0] };
  // primeiro nome, ou parte do nome
  const parcial = pessoas.filter((p) => {
    const nome = semTitulo(p.nome);
    return nome.split(/\s+/).includes(r) || nome.startsWith(r + " ");
  });
  if (parcial.length === 1) return { ok: true, pessoa: parcial[0] };
  if (parcial.length > 1) return { ok: false, motivo: "ambigua", candidatas: parcial };
  return { ok: false, motivo: "inexistente", candidatas: [] };
}
