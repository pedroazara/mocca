"use client";

import { FileText, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { atualizarTarefa } from "@/app/painel/acoes";
import { estiloControle } from "@/components/ui/campo";
import { estaAtrasada } from "@/lib/painel/datas";
import type { TarefaResumo } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { ChipAtrasada, ChipEtiqueta, EstadoVazio, PilhaAvatares, Prazo } from "./elementos";
import { ItemMarcavel, progresso } from "./tarefa-pecas";

// "Minhas tarefas" (seção 9.2) e "Tarefas de {nome}" (seção 9.8): abas,
// agrupamento por prazo, itens da pessoa expandidos, filtro e busca.

type Aba = "abertas" | "feitas" | "todas";

export function ListaTarefasPessoa({ tarefas, pessoaId }: { tarefas: TarefaResumo[]; pessoaId: string }) {
  const { etiquetas, semanaAtual, eu } = usePainel();
  const [aba, setAba] = useState<Aba>("abertas");
  const [etiqueta, setEtiqueta] = useState("");
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(
    () =>
      tarefas.filter(
        (t) =>
          (aba === "todas" || (aba === "feitas" ? t.status === "feito" : t.status !== "feito")) &&
          (!etiqueta || t.etiquetas.includes(etiqueta)) &&
          (!busca || t.titulo.toLowerCase().includes(busca.toLowerCase())),
      ),
    [tarefas, aba, etiqueta, busca],
  );

  const grupos: { titulo: string; lista: TarefaResumo[] }[] = [
    { titulo: "Atrasadas", lista: filtradas.filter((t) => estaAtrasada(t)) },
    { titulo: "Esta semana", lista: filtradas.filter((t) => !estaAtrasada(t) && t.semana === semanaAtual) },
    {
      titulo: "Próximas semanas",
      lista: filtradas.filter((t) => !estaAtrasada(t) && t.semana !== null && t.semana > semanaAtual),
    },
    {
      titulo: "Semanas anteriores",
      lista: filtradas.filter((t) => !estaAtrasada(t) && t.semana !== null && t.semana < semanaAtual),
    },
    { titulo: "Sem semana", lista: filtradas.filter((t) => !estaAtrasada(t) && t.semana === null) },
  ];

  const contagem = (a: Aba) =>
    tarefas.filter((t) => a === "todas" || (a === "feitas" ? t.status === "feito" : t.status !== "feito")).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1 rounded-m bg-superficie-2 p-1" role="tablist" aria-label="Filtrar por situação">
          {(["abertas", "feitas", "todas"] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={aba === a}
              onClick={() => setAba(a)}
              className={cn(
                "rounded-p px-3 py-1.5 text-[0.875rem] capitalize",
                aba === a ? "bg-superficie font-semibold text-texto shadow-cartao" : "text-texto-2 hover:text-texto",
              )}
            >
              {a} <span className="t-dado text-texto-2">{contagem(a)}</span>
            </button>
          ))}
        </div>
        <div className="flex min-w-0 gap-2">
          <select
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            aria-label="Filtrar por etiqueta"
            className={cn(estiloControle, "h-9 w-auto min-w-0 shrink")}
          >
            <option value="">Todas as etiquetas</option>
            {etiquetas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
          <label className="relative min-w-0 flex-1 sm:flex-none">
            <Search aria-hidden strokeWidth={1.75} className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-texto-2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar"
              aria-label="Buscar nas tarefas"
              className={cn(estiloControle, "h-9 pl-8 sm:w-44")}
            />
          </label>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <EstadoVazio
          texto={
            aba === "abertas"
              ? pessoaId === eu.id
                ? "Nada aberto com você. Quando alguém te atribuir uma tarefa, ela aparece aqui."
                : "Nenhuma tarefa aberta com esta pessoa."
              : "Nenhuma tarefa por aqui."
          }
        />
      ) : (
        grupos
          .filter((g) => g.lista.length)
          .map((g) => (
            <section key={g.titulo} aria-label={g.titulo}>
              <h2 className={cn("t-rotulo mb-2", g.titulo === "Atrasadas" ? "text-erro" : "text-texto-2")}>
                {g.titulo} <span className="t-dado">({g.lista.length})</span>
              </h2>
              <ul className="flex flex-col divide-y divide-linha rounded-m border border-linha bg-superficie">
                {g.lista.map((t) => (
                  <LinhaTarefa key={t.id} tarefa={t} pessoaId={pessoaId} />
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}

function LinhaTarefa({ tarefa: t, pessoaId }: { tarefa: TarefaResumo; pessoaId: string }) {
  const { etiqueta, pessoa, podeEditar, avisar } = usePainel();
  const [status, setStatus] = useOptimistic(t.status);
  const [, iniciar] = useTransition();
  const minhas = t.atribuicoes.find((a) => a.pessoa_id === pessoaId)?.itens ?? [];
  const outros = t.atribuicoes.filter((a) => a.pessoa_id !== pessoaId).map((a) => pessoa(a.pessoa_id));
  const { feitos, total } = progresso(t);
  const feita = status === "feito";

  return (
    <li className="px-3 py-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={feita}
          disabled={!podeEditar}
          aria-label={feita ? `Reabrir "${t.titulo}"` : `Marcar "${t.titulo}" como feita`}
          title="Marcar como feita"
          onChange={(e) => {
            const novo = e.target.checked ? "feito" : "a_fazer";
            iniciar(async () => {
              setStatus(novo);
              const r = await atualizarTarefa(t.id, { status: novo });
              if (!r.ok) avisar(r.erro, { erro: true });
              else if (novo === "feito")
                avisar("Tarefa feita.", { desfazer: () => atualizarTarefa(t.id, { status: t.status }) });
            });
          }}
          className="mt-1 size-[18px] shrink-0 accent-[var(--ok)]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href={`/painel/tarefas/${t.id}`}
              className={cn("font-medium hover:underline", feita ? "text-texto-2 line-through" : "text-texto")}
            >
              {t.titulo}
            </Link>
            {estaAtrasada({ prazo: t.prazo, status }) && <ChipAtrasada />}
            {t.etiquetas.map((e) => (
              <ChipEtiqueta key={e} etiqueta={etiqueta(e)} />
            ))}
          </div>
          {minhas.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5">
              {minhas.map((i) => (
                <ItemMarcavel key={i.id} item={i} />
              ))}
            </div>
          )}
        </div>
        <div className="hidden shrink-0 items-center gap-3 text-texto-2 sm:flex">
          {t.semana && <span className="t-dado text-[0.8125rem]">S{t.semana}</span>}
          <Prazo prazo={t.prazo} status={status} curto />
          {t.documentos > 0 && <FileText aria-label="Tem documento" strokeWidth={1.75} className="size-4" />}
          {total > 0 && (
            <span className="t-dado text-[0.8125rem]">
              {feitos}/{total}
            </span>
          )}
          <PilhaAvatares pessoas={outros} />
        </div>
      </div>
    </li>
  );
}
