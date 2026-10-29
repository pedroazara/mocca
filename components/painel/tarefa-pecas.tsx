"use client";

import { FileText, MapPin, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { marcarItem } from "@/app/painel/acoes";
import { estaAtrasada } from "@/lib/painel/datas";
import type { Item, TarefaResumo } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { ChipAtrasada, ChipEtiqueta, PilhaAvatares, Prazo } from "./elementos";

// Peças de tarefa usadas em várias telas: item de checklist marcável e cartão.

export function ItemMarcavel({ item, desabilitado = false }: { item: Item; desabilitado?: boolean }) {
  const { avisar, podeEditar } = usePainel();
  const [feito, setFeito] = useOptimistic(item.feito);
  const [, iniciar] = useTransition();
  const bloqueado = desabilitado || !podeEditar;
  return (
    <label
      className={cn(
        "flex items-start gap-2 rounded-p py-0.5 text-[0.875rem] leading-snug",
        bloqueado ? "cursor-default" : "cursor-pointer",
      )}
    >
      <input
        type="checkbox"
        checked={feito}
        disabled={bloqueado}
        onChange={(e) => {
          const novo = e.target.checked;
          iniciar(async () => {
            setFeito(novo);
            const r = await marcarItem(item.id, novo);
            if (!r.ok) avisar(r.erro, { erro: true });
          });
        }}
        className="mt-0.5 size-4 shrink-0 accent-[var(--botao-primario)]"
      />
      <span className={cn(feito ? "text-texto-2 line-through" : "text-texto")}>{item.texto}</span>
    </label>
  );
}

export function progresso(t: Pick<TarefaResumo, "atribuicoes">) {
  const itens = t.atribuicoes.flatMap((a) => a.itens);
  return { feitos: itens.filter((i) => i.feito).length, total: itens.length };
}

// Cartão de tarefa (seção 9.3): etiquetas, título, prazo, ícones e avatares.
// Com `itensDe`, mostra embaixo do título os itens daquela pessoa, marcáveis.
export function CartaoTarefa({
  tarefa: t,
  itensDe,
  className,
  arrastando = false,
}: {
  tarefa: TarefaResumo;
  itensDe?: string;
  className?: string;
  arrastando?: boolean;
}) {
  const { pessoa, etiqueta } = usePainel();
  const { feitos, total } = progresso(t);
  const atrasada = estaAtrasada(t);
  const itens = itensDe ? t.atribuicoes.find((a) => a.pessoa_id === itensDe)?.itens ?? [] : [];
  return (
    <article
      className={cn(
        "relative rounded-m border border-linha bg-superficie p-3 transition-shadow duration-150",
        arrastando && "rotate-[1.5deg] shadow-flutuante",
        className,
      )}
    >
      {t.ligada_entrega && (
        <MapPin
          aria-label="Ligada à entrega do programa"
          strokeWidth={2}
          className="absolute top-2.5 right-2.5 size-4 fill-caramelo/25 text-caramelo"
        />
      )}
      {(t.etiquetas.length > 0 || atrasada) && (
        <div className="mb-2 flex flex-wrap gap-1.5 pr-5">
          {atrasada && <ChipAtrasada />}
          {t.etiquetas.map((e) => (
            <ChipEtiqueta key={e} etiqueta={etiqueta(e)} />
          ))}
        </div>
      )}
      <Link
        href={`/painel/tarefas/${t.id}`}
        className={cn(
          "line-clamp-3 pr-5 font-medium text-texto after:absolute after:inset-0 after:content-[''] hover:underline",
          t.status === "feito" && "text-texto-2",
        )}
      >
        {t.titulo}
      </Link>
      {itens.length > 0 && (
        <div className="relative z-10 mt-2 flex flex-col gap-0.5">
          {itens.map((i) => (
            <ItemMarcavel key={i.id} item={i} />
          ))}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-3 text-texto-2">
        <Prazo prazo={t.prazo} status={t.status} curto />
        {t.documentos > 0 && (
          <span className="inline-flex items-center gap-1 text-[0.8125rem]" title={`${t.documentos} documentos`}>
            <FileText aria-hidden strokeWidth={1.75} className="size-3.5" />
            <span className="t-dado">{t.documentos}</span>
          </span>
        )}
        {t.comentarios > 0 && (
          <span className="inline-flex items-center gap-1 text-[0.8125rem]" title={`${t.comentarios} comentários`}>
            <MessageSquare aria-hidden strokeWidth={1.75} className="size-3.5" />
            <span className="t-dado">{t.comentarios}</span>
          </span>
        )}
        {total > 0 && (
          <span className="t-dado text-[0.8125rem]" title="Itens feitos">
            {feitos}/{total}
          </span>
        )}
        <span className="ml-auto">
          <PilhaAvatares pessoas={t.atribuicoes.map((a) => pessoa(a.pessoa_id))} />
        </span>
      </div>
    </article>
  );
}
