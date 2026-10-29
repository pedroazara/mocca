"use client";

import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { adicionarDocumento, atualizarSemana, removerDocumento } from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { estiloControle } from "@/components/ui/campo";
import { Chip } from "@/components/ui/chip";
import { deCampoData, diaCurto, paraCampoData } from "@/lib/painel/datas";
import { STATUS_SEMANA, type Semana, type StatusSemana, type TarefaResumo } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { iconeDocumento, tituloPelaUrl } from "./detalhe-tarefa";
import { Markdown } from "./markdown";

// Semanas do programa (seção 9.5): linha do tempo com anel de progresso,
// tabela, e na página da semana as anotações, documentos e a edição (admin).

const estadoSemana = { nao_iniciada: "neutro", em_andamento: "info", entregue: "ok" } as const;

function Anel({ feitas, total }: { feitas: number; total: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const pct = total ? feitas / total : 0;
  return (
    <svg viewBox="0 0 40 40" className="size-10 -rotate-90" role="img" aria-label={`${feitas} de ${total} tarefas feitas`}>
      <circle cx={20} cy={20} r={r} fill="none" className="stroke-linha" strokeWidth={4} />
      <circle
        cx={20}
        cy={20}
        r={r}
        fill="none"
        className="stroke-caramelo"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${pct * c} ${c}`}
      />
    </svg>
  );
}

export function LinhaDoTempoSemanas({ tarefas }: { tarefas: TarefaResumo[] }) {
  const { semanas, semanaAtual } = usePainel();
  const contar = (n: number) => {
    const da = tarefas.filter((t) => t.semana === n);
    return { feitas: da.filter((t) => t.status === "feito").length, total: da.length, abertas: da.filter((t) => t.status !== "feito").length };
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:-mx-8 lg:px-8">
        <ol className="flex gap-3">
          {semanas.map((s) => {
            const { feitas, total } = contar(s.numero);
            const atual = s.numero === semanaAtual;
            return (
              <li key={s.id} className="w-[200px] shrink-0">
                <Link
                  href={`/painel/semanas/${s.numero}`}
                  aria-current={atual ? "date" : undefined}
                  className={cn(
                    "flex h-full flex-col gap-3 rounded-m border bg-superficie p-4 transition-colors duration-150 hover:bg-superficie-2",
                    atual ? "border-2 border-caramelo" : "border-linha",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-titulo text-[1.125rem] font-semibold text-texto">S{s.numero}</span>
                    <Anel feitas={feitas} total={total} />
                  </div>
                  <span className="t-dado text-[0.8125rem] text-texto-2">
                    {diaCurto(s.inicio)} a {diaCurto(s.fim)}
                  </span>
                  <span className="line-clamp-2 text-[0.875rem] text-texto">{s.entrega_titulo ?? "Sem entrega"}</span>
                  <span className="t-dado mt-auto text-[0.75rem] text-texto-2">
                    {feitas}/{total} feitas{atual ? " · atual" : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="overflow-x-auto rounded-m border border-linha bg-superficie">
        <table className="w-full min-w-[760px] text-left text-[0.9375rem]">
          <thead className="bg-superficie-2">
            <tr className="t-rotulo text-texto-2">
              <th className="px-4 py-2.5 font-medium">Semana</th>
              <th className="px-4 py-2.5 font-medium">Datas</th>
              <th className="px-4 py-2.5 font-medium">Entrega do programa</th>
              <th className="px-4 py-2.5 font-medium">Entregável</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Abertas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linha">
            {semanas.map((s) => (
              <tr key={s.id} className={cn(s.numero === semanaAtual && "bg-caramelo/[0.06]")}>
                <td className="px-4 py-3">
                  <Link href={`/painel/semanas/${s.numero}`} className="font-semibold text-texto hover:underline">
                    Semana {s.numero}
                  </Link>
                </td>
                <td className="t-dado px-4 py-3 text-[0.8125rem] text-texto-2">
                  {diaCurto(s.inicio)} a {diaCurto(s.fim)}
                </td>
                <td className="px-4 py-3 text-texto">{s.entrega_titulo ?? "–"}</td>
                <td className="px-4 py-3">
                  {s.entrega_url ? (
                    <a href={s.entrega_url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
                      Abrir <ExternalLink aria-hidden strokeWidth={1.75} className="size-3.5" />
                    </a>
                  ) : (
                    <span className="text-texto-2">–</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Chip estado={estadoSemana[s.status]}>{STATUS_SEMANA[s.status]}</Chip>
                </td>
                <td className="t-dado px-4 py-3 text-right text-texto">{contar(s.numero).abertas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DetalhesSemana({
  semana: s,
  documentos,
}: {
  semana: Semana;
  documentos: { id: string; titulo: string; url: string; tipo: string }[];
}) {
  const { ehAdmin, podeEditar, avisar } = usePainel();
  const [editando, setEditando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [f, setF] = useState({
    entrega_titulo: s.entrega_titulo ?? "",
    entrega_prazo: paraCampoData(s.entrega_prazo),
    entrega_url: s.entrega_url ?? "",
    status: s.status,
    inicio: s.inicio,
    fim: s.fim,
    anotacoes: s.anotacoes ?? "",
  });
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");

  const salvar = () =>
    iniciar(async () => {
      const r = await atualizarSemana(s.id, {
        entrega_titulo: f.entrega_titulo || null,
        entrega_prazo: deCampoData(f.entrega_prazo),
        entrega_url: f.entrega_url || null,
        status: f.status,
        inicio: f.inicio,
        fim: f.fim,
        anotacoes: f.anotacoes || null,
      });
      if (!r.ok) avisar(r.erro, { erro: true });
      else {
        avisar("Semana atualizada.");
        setEditando(false);
      }
    });

  const campo = cn(estiloControle, "h-9");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section aria-labelledby="anotacoes" className="rounded-g border border-linha bg-superficie p-5">
        <div className="flex items-center justify-between">
          <h2 id="anotacoes" className="t-rotulo text-texto-2">
            Anotações da semana
          </h2>
          {ehAdmin && !editando && (
            <Botao variante="fantasma" tamanho="painel" onClick={() => setEditando(true)}>
              <Pencil aria-hidden /> Editar semana
            </Botao>
          )}
        </div>
        {editando ? (
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1">
              <span className="text-[0.875rem] font-semibold">Entrega do programa</span>
              <input className={campo} value={f.entrega_titulo} onChange={(e) => setF({ ...f, entrega_titulo: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-[0.875rem] font-semibold">Prazo da entrega</span>
                <input type="date" className={campo} value={f.entrega_prazo} onChange={(e) => setF({ ...f, entrega_prazo: e.target.value })} />
              </label>
              <label className="grid gap-1">
                <span className="text-[0.875rem] font-semibold">Status</span>
                <select className={campo} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as StatusSemana })}>
                  {Object.entries(STATUS_SEMANA).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-[0.875rem] font-semibold">Início</span>
                <input type="date" className={campo} value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />
              </label>
              <label className="grid gap-1">
                <span className="text-[0.875rem] font-semibold">Fim</span>
                <input type="date" className={campo} value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} />
              </label>
            </div>
            <label className="grid gap-1">
              <span className="text-[0.875rem] font-semibold">Link do entregável</span>
              <input className={campo} value={f.entrega_url} placeholder="https://docs.google.com/…" onChange={(e) => setF({ ...f, entrega_url: e.target.value })} />
            </label>
            <label className="grid gap-1">
              <span className="text-[0.875rem] font-semibold">Anotações (Markdown)</span>
              <textarea
                className={cn(estiloControle, "min-h-40 py-2")}
                value={f.anotacoes}
                onChange={(e) => setF({ ...f, anotacoes: e.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Botao variante="fantasma" tamanho="painel" onClick={() => setEditando(false)}>
                Cancelar
              </Botao>
              <Botao tamanho="painel" disabled={pendente} onClick={salvar}>
                Salvar semana
              </Botao>
            </div>
          </div>
        ) : s.anotacoes ? (
          <Markdown texto={s.anotacoes} className="mt-3" />
        ) : (
          <p className="mt-3 text-[0.875rem] text-texto-2">Sem anotações nesta semana.</p>
        )}
      </section>

      <section aria-labelledby="docs-semana" className="rounded-g border border-linha bg-superficie p-5">
        <h2 id="docs-semana" className="t-rotulo text-texto-2">
          Aula, mentoria e documentos
        </h2>
        <ul className="mt-3 flex flex-col gap-1">
          {documentos.map((d) => {
            const Icone = iconeDocumento(d.url);
            return (
              <li key={d.id} className="group flex items-center gap-2.5 py-1">
                <Icone aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-caramelo" />
                <a href={d.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-texto hover:underline">
                  {d.titulo}
                </a>
                {podeEditar && (
                  <button
                    type="button"
                    aria-label={`Remover ${d.titulo}`}
                    onClick={() => iniciar(async () => void (await removerDocumento(d.id)))}
                    className="rounded-p p-1 text-texto-2 opacity-0 group-hover:opacity-100 hover:text-erro focus-visible:opacity-100"
                  >
                    <Trash2 aria-hidden strokeWidth={1.75} className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
          {documentos.length === 0 && <li className="text-[0.875rem] text-texto-2">Nenhum documento nesta semana.</li>}
        </ul>
        {podeEditar && (
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              iniciar(async () => {
                const r = await adicionarDocumento({ semanaId: s.id, titulo: titulo || tituloPelaUrl(url), url, tipo: "outro" });
                if (!r.ok) avisar(r.erro, { erro: true });
                else {
                  setUrl("");
                  setTitulo("");
                }
              });
            }}
          >
            <input className={campo} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link do Drive (aula, slides…)" aria-label="Link do documento" />
            <div className="flex gap-2">
              <input className={cn(campo, "flex-1")} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" aria-label="Título do documento" />
              <Botao type="submit" variante="secundario" tamanho="painel" disabled={!url || pendente}>
                <Plus aria-hidden /> Ligar
              </Botao>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
