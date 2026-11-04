"use client";

import { AlertTriangle, Clock } from "lucide-react";
import Image from "next/image";
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
  foto,
}: {
  pessoa: Pick<Pessoa, "nome" | "cor"> | undefined;
  tamanho?: keyof typeof tamanhos;
  className?: string;
  titulo?: boolean;
  foto?: string | null;
}) {
  if (!pessoa) return null;
  return (
    <span
      title={titulo ? pessoa.nome : undefined}
      className={cn(
        // o fio por dentro destaca as cores escuras (o café do Pedro) no tema escuro
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-titulo font-semibold text-creme shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--texto)_14%,transparent)]",
        tamanhos[tamanho],
        className,
      )}
      style={{ backgroundColor: pessoa.cor }}
    >
      {foto ? <Image src={foto} alt="" fill unoptimized className="object-cover" /> : iniciais(pessoa.nome)}
    </span>
  );
}

export function PilhaAvatares({
  pessoas,
  tamanho = 20,
  maximo = 4,
}: {
  pessoas: (Pessoa | undefined)[];
  tamanho?: 20 | 28;
  maximo?: number;
}) {
  const lista = pessoas.filter(Boolean) as Pessoa[];
  if (!lista.length) return null;
  return (
    <span className="flex shrink-0 items-center" aria-label={lista.map((p) => p.nome).join(", ")}>
      {lista.slice(0, maximo).map((p, i) => (
        <Avatar
          key={p.id}
          pessoa={p}
          tamanho={tamanho}
          titulo
          className={cn(
            // no tamanho 20, sobrepor pouco: com mais, a segunda inicial some
            tamanho === 20 ? "ring-[1.5px] ring-superficie" : "ring-2 ring-superficie",
            i > 0 && (tamanho === 20 ? "-ml-px" : "-ml-1.5"),
          )}
        />
      ))}
      {lista.length > maximo && <span className="t-dado ml-1 text-[0.75rem] text-texto-2">+{lista.length - maximo}</span>}
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

// Cor do prazo: atrasado em erro, até 2 dias em alerta.
export function corPrazo(prazo: string, status: Status) {
  if (status === "feito") return "text-texto-2";
  if (estaAtrasada({ prazo, status })) return "text-erro";
  return diasAtePrazo(prazo) <= 2 ? "text-alerta" : "text-texto-2";
}

export function Prazo({ prazo, status, curto = false }: { prazo: string | null; status: Status; curto?: boolean }) {
  if (!prazo) return null;
  return (
    <span className={cn("t-dado inline-flex items-center gap-1 text-[0.8125rem]", corPrazo(prazo, status))} title={textoPrazo(prazo)}>
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
      <p className="max-w-[36ch] text-texto-2">{texto}</p>
      {acao}
    </div>
  );
}
