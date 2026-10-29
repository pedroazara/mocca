"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { estiloControle } from "@/components/ui/campo";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";

// Filtros do Quadro (seção 9.3): ficam na URL, então dá para compartilhar.
export function FiltrosQuadro() {
  const { semanas, semanaAtual, ativas, etiquetas } = usePainel();
  const params = useSearchParams();
  const caminho = usePathname();
  const router = useRouter();

  const mudar = (chave: string, valor: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (valor === null || valor === "") p.delete(chave);
    else p.set(chave, valor);
    router.replace(`${caminho}${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };

  const semana = params.get("semana") ?? String(semanaAtual);
  const controle = cn(estiloControle, "h-9 w-auto");

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filtros do quadro">
      <select aria-label="Semana" value={semana} onChange={(e) => mudar("semana", e.target.value)} className={controle}>
        <option value="todas">Todas as semanas</option>
        {semanas.map((s) => (
          <option key={s.numero} value={s.numero}>
            Semana {s.numero}
            {s.numero === semanaAtual ? " (atual)" : ""}
          </option>
        ))}
      </select>
      <select aria-label="Pessoa" value={params.get("pessoa") ?? ""} onChange={(e) => mudar("pessoa", e.target.value)} className={controle}>
        <option value="">Todas as pessoas</option>
        {ativas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
      <select aria-label="Etiqueta" value={params.get("etiqueta") ?? ""} onChange={(e) => mudar("etiqueta", e.target.value)} className={controle}>
        <option value="">Todas as etiquetas</option>
        {etiquetas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>
      <label className="flex h-9 items-center gap-2 rounded-p border border-linha bg-superficie px-3 text-[0.9375rem] text-texto">
        <input
          type="checkbox"
          checked={params.get("atrasadas") === "1"}
          onChange={(e) => mudar("atrasadas", e.target.checked ? "1" : null)}
          className="size-4 accent-[var(--botao-primario)]"
        />
        Só atrasadas
      </label>
      {params.toString() && (
        <button type="button" onClick={() => router.replace(caminho, { scroll: false })} className="link ml-1 text-[0.875rem]">
          Limpar filtros
        </button>
      )}
    </div>
  );
}
