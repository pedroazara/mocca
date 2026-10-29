import { z } from "zod";

// Schema único do formulário de contato (seção 6.6): o mesmo valida no navegador
// (react-hook-form) e na rota POST /api/contato.

export const perfis = [
  { valor: "produtor", rotulo: "Produtor" },
  { valor: "fabricante", rotulo: "Fabricante ou revenda de máquinas" },
  { valor: "locadora", rotulo: "Locadora de máquinas" },
  { valor: "pesquisador", rotulo: "Pesquisador" },
  { valor: "imprensa", rotulo: "Imprensa" },
  { valor: "outro", rotulo: "Outro" },
] as const;

export const tiposColheita = ["Manual", "Semimecanizada", "Mecanizada", "Mista"] as const;

const valoresPerfil = perfis.map((p) => p.valor) as [
  (typeof perfis)[number]["valor"],
  ...(typeof perfis)[number]["valor"][],
];

export function soDigitos(v: string) {
  return v.replace(/\D/g, "");
}

// Máscara brasileira: (35) 99999-9999 ou (35) 3333-3333
export function formatarTelefone(v: string) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function lerArea(v: string | undefined) {
  if (!v) return null;
  const n = Number(v.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export const esquemaContato = z
  .object({
    nome: z
      .string()
      .trim()
      .min(2, "Escreva seu nome, com pelo menos 2 letras.")
      .max(120, "Use no máximo 120 caracteres."),
    email: z
      .string()
      .trim()
      .min(1, "Informe seu e-mail.")
      .pipe(z.email("Confira o e-mail: ele parece incompleto.")),
    telefone: z
      .string()
      .trim()
      .optional()
      .refine((v) => {
        const d = soDigitos(v ?? "");
        return d.length === 0 || d.length === 10 || d.length === 11;
      }, "Use DDD e número, como (35) 99999-9999."),
    perfil: z.enum(valoresPerfil, { error: "Escolha uma opção." }),
    cidade_uf: z.string().trim().max(120, "Use no máximo 120 caracteres.").optional(),
    area_ha: z.string().trim().optional(),
    tipo_colheita: z.string().optional(),
    mensagem: z
      .string()
      .trim()
      .min(10, "Conte um pouco mais, com pelo menos 10 caracteres.")
      .max(3000, "Use no máximo 3000 caracteres."),
    consentimento: z.literal(true, { error: "Marque a caixa para podermos guardar seus dados e responder." }),
  })
  .superRefine(
    (v, ctx) => {
      if (v.perfil !== "produtor") return;
      const area = lerArea(typeof v.area_ha === "string" ? v.area_ha : undefined);
      if (area === null) {
        ctx.addIssue({ code: "custom", path: ["area_ha"], message: "Informe a área de café, em hectares." });
      } else if (Number.isNaN(area) || area < 0 || area > 100000) {
        ctx.addIssue({ code: "custom", path: ["area_ha"], message: "Use um número entre 0 e 100000." });
      }
      if (!tiposColheita.includes(v.tipo_colheita as (typeof tiposColheita)[number])) {
        ctx.addIssue({ code: "custom", path: ["tipo_colheita"], message: "Escolha o tipo de colheita." });
      }
    },
    // roda mesmo com erro em outros campos, para a pessoa ver todos os erros de uma vez
    { when: (p) => (p.value as { perfil?: unknown } | undefined)?.perfil === "produtor" },
  );

export type EntradaContato = z.input<typeof esquemaContato>;
export type DadosContato = z.output<typeof esquemaContato>;

// Converte o que o formulário enviou no registro da tabela `contato`.
export function paraRegistro(v: DadosContato) {
  const produtor = v.perfil === "produtor";
  const telefone = soDigitos(v.telefone ?? "");
  return {
    nome: v.nome,
    email: v.email.toLowerCase(),
    telefone: telefone || null,
    perfil: v.perfil,
    cidade_uf: v.cidade_uf || null,
    area_ha: produtor ? lerArea(v.area_ha) : null,
    tipo_colheita: produtor ? (v.tipo_colheita ?? null) : null,
    mensagem: v.mensagem,
    consentiu: true,
  };
}
