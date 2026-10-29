"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { estaAtrasada, textoPrazo, dataCurta, diasAtePrazo } from "@/lib/painel/datas";
import type { Etiqueta, Pessoa, Status } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";

// Peças pequenas do painel (seção 5): avatar, pilha de avatares, chips.

function iniciais(nome: string) {
  const partes = nome.replace(/^Prof\.\s*/, "").split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

const tamanhos = { 20: "size-5 text-[9px]", 28: "size-7 text-[11px]", 40: "size-10 text-[14px]" } as const;

export function Avatar({
  pessoa,
  tamanho = 28,
  className,
  titulo = true,
}: {
  pessoa: Pick<Pessoa, "nome" | "cor"> | undefined;
  tamanho?: keyof typeof tamanhos;
  className?: string;
  titulo?: boolean;
}) {
  if (!pessoa) return null;
  return (
    <span
      title={titulo ? pessoa.nome : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-titulo font-semibold text-creme",
        tamanhos[tamanho],
        className,
      )}
      style={{ backgroundColor: pessoa.cor }}
    >
      {iniciais(pessoa.nome)}
    </span>
  );
}

export function PilhaAvatares({ pessoas, tamanho = 20 }: { pessoas: (Pessoa | undefined)[]; tamanho?: 20 | 28 }) {
  const lista = pessoas.filter(Boolean) as Pessoa[];
  if (!lista.length) return null;
  return (
    <span className="flex items-center" aria-label={lista.map((p) => p.nome).join(", ")}>
      {lista.slice(0, 4).map((p, i) => (
        <Avatar
          key={p.id}
          pessoa={p}
          tamanho={tamanho}
          titulo
          className={cn("ring-2 ring-superficie", i > 0 && "-ml-1.5")}
        />
      ))}
      {lista.length > 4 && <span className="t-dado ml-1 text-[0.75rem] text-texto-2">+{lista.length - 4}</span>}
    </span>
  );
}

const corEtiqueta: Record<string, string> = {
  "et-entregas": "text-et-entregas bg-et-entregas/[0.14]",
  "et-validacao": "text-et-validacao bg-et-validacao/[0.14]",
  "et-tecnico": "text-et-tecnico bg-et-tecnico/[0.14]",
  "et-negocio": "text-et-negocio bg-et-negocio/[0.14]",
  "et-marketing": "text-et-marketing bg-et-marketing/[0.14]",
};

export function ChipEtiqueta({ etiqueta }: { etiqueta: Etiqueta | undefined }) {
  if (!etiqueta) return null;
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[0.75rem] font-medium whitespace-nowrap",
        corEtiqueta[etiqueta.token] ?? "bg-superficie-2 text-texto-2",
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {etiqueta.nome}
    </span>
  );
}

export function ChipAtrasada() {
  return (
    <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-erro-fundo px-2 text-[0.75rem] font-medium text-erro">
      <AlertTriangle aria-hidden strokeWidth={2} className="size-3" />
      atrasada
    </span>
  );
}

// Prazo com cor de estado: atrasado em erro, até 2 dias em alerta.
export function Prazo({ prazo, status, curto = false }: { prazo: string | null; status: Status; curto?: boolean }) {
  if (!prazo) return null;
  const atrasada = estaAtrasada({ prazo, status });
  const dias = diasAtePrazo(prazo);
  const cor =
    status === "feito" ? "text-texto-2" : atrasada ? "text-erro" : dias <= 2 ? "text-alerta" : "text-texto-2";
  return (
    <span className={cn("t-dado inline-flex items-center gap-1 text-[0.8125rem]", cor)} title={textoPrazo(prazo)}>
      <Clock aria-hidden strokeWidth={1.75} className="size-3.5" />
      {curto || status === "feito" ? dataCurta(prazo) : `${dataCurta(prazo)} · ${textoPrazo(prazo)}`}
    </span>
  );
}

export function EstadoVazio({
  texto,
  acao,
}: {
  texto: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-m border border-dashed border-linha px-6 py-10 text-center">
      <span
        aria-hidden
        className="inline-block h-12 w-[35px] bg-linha"
        style={{
          maskImage: "url(/logo/mocca-simbolo.svg)",
          WebkitMaskImage: "url(/logo/mocca-simbolo.svg)",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
        }}
      />
      <p className="max-w-[36ch] text-texto-2">{texto}</p>
      {acao}
    </div>
  );
}
