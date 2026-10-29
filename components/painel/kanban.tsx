"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { criarTarefa, moverTarefa } from "@/app/painel/acoes";
import { estiloControle } from "@/components/ui/campo";
import { STATUS, rotuloStatus, type Status, type TarefaResumo } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { CartaoTarefa } from "./tarefa-pecas";

// Quadro (seção 9.3): A fazer · Fazendo · Em revisão · Feito. Arrastar entre
// colunas muda o status; dentro da coluna, a ordem. Mouse, toque e teclado
// (espaço pega, setas movem, espaço solta).

type Colunas = Record<Status, TarefaResumo[]>;
const LIMITE_FEITO = 20;

function agrupar(tarefas: TarefaResumo[]): Colunas {
  const c: Colunas = { a_fazer: [], fazendo: [], em_revisao: [], feito: [] };
  for (const t of tarefas) c[t.status].push(t);
  for (const s of Object.keys(c) as Status[]) c[s].sort((a, b) => a.posicao - b.posicao);
  return c;
}

function posicaoEntre(antes?: TarefaResumo, depois?: TarefaResumo) {
  if (antes && depois) return (antes.posicao + depois.posicao) / 2;
  if (antes) return antes.posicao + 1;
  if (depois) return depois.posicao - 1;
  return 1;
}

export function Kanban({ tarefas, semanaFiltro, feitasTodas }: { tarefas: TarefaResumo[]; semanaFiltro: number | null; feitasTodas: boolean }) {
  const { avisar, podeEditar } = usePainel();
  const [colunas, setColunas] = useState<Colunas>(() => agrupar(tarefas));
  const [ativo, setAtivo] = useState<TarefaResumo | null>(null);
  const origem = useRef<{ status: Status; posicao: number } | null>(null);
  const arrastou = useRef(false);
  const [, iniciar] = useTransition();

  useEffect(() => {
    if (!ativo) setColunas(agrupar(tarefas));
  }, [tarefas, ativo]);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const colunaDe = (id: UniqueIdentifier): Status | undefined => {
    if (STATUS.some((s) => s.valor === id)) return id as Status;
    return (Object.keys(colunas) as Status[]).find((s) => colunas[s].some((t) => t.id === id));
  };
  const tituloDe = (id: UniqueIdentifier) => {
    for (const s of Object.keys(colunas) as Status[]) {
      const t = colunas[s].find((x) => x.id === id);
      if (t) return t.titulo;
    }
    return "tarefa";
  };

  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Tarefa "${tituloDe(active.id)}" pega. Use as setas para mover e espaço para soltar.`,
    onDragOver: ({ active, over }) =>
      over ? `"${tituloDe(active.id)}" está sobre a coluna ${rotuloStatus(colunaDe(over.id) ?? "a_fazer")}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `"${tituloDe(active.id)}" solta em ${rotuloStatus(colunaDe(over.id) ?? "a_fazer")}.` : "Movimento cancelado.",
    onDragCancel: ({ active }) => `Movimento de "${tituloDe(active.id)}" cancelado.`,
  };

  function inicio(e: DragStartEvent) {
    const s = colunaDe(e.active.id)!;
    const t = colunas[s].find((x) => x.id === e.active.id)!;
    origem.current = { status: s, posicao: t.posicao };
    arrastou.current = true;
    setAtivo(t);
  }

  function sobre(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const de = colunaDe(active.id);
    const para = colunaDe(over.id);
    if (!de || !para || de === para) return;
    setColunas((c) => {
      const item = c[de].find((t) => t.id === active.id)!;
      const destino = [...c[para]];
      const idx = destino.findIndex((t) => t.id === over.id);
      destino.splice(idx >= 0 ? idx : destino.length, 0, { ...item, status: para });
      return { ...c, [de]: c[de].filter((t) => t.id !== active.id), [para]: destino };
    });
  }

  function fim(e: DragEndEvent) {
    const { active, over } = e;
    setAtivo(null);
    window.setTimeout(() => (arrastou.current = false), 50);
    const o = origem.current;
    if (!over || !o) {
      setColunas(agrupar(tarefas));
      return;
    }
    const s = colunaDe(active.id)!;
    let lista = colunas[s];
    const de = lista.findIndex((t) => t.id === active.id);
    const para = colunaDe(over.id) === s && over.id !== s ? lista.findIndex((t) => t.id === over.id) : de;
    if (para !== de && para >= 0) lista = arrayMove(lista, de, para);
    const idx = lista.findIndex((t) => t.id === active.id);
    const pos = posicaoEntre(lista[idx - 1], lista[idx + 1]);
    lista = lista.map((t) => (t.id === active.id ? { ...t, posicao: pos, status: s } : t));
    setColunas((c) => ({ ...c, [s]: lista }));
    if (s === o.status && pos === o.posicao) return;
    const id = String(active.id);
    iniciar(async () => {
      const r = await moverTarefa(id, s, pos);
      if (!r.ok) {
        avisar(r.erro, { erro: true });
        setColunas(agrupar(tarefas));
      } else if (s !== o.status) {
        avisar(`Movida para ${rotuloStatus(s)}.`, {
          desfazer: () => {
            moverTarefa(id, o.status, o.posicao).then((d) => !d.ok && avisar(d.erro, { erro: true }));
          },
        });
      }
    });
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCorners}
      onDragStart={inicio}
      onDragOver={sobre}
      onDragEnd={fim}
      onDragCancel={() => {
        setAtivo(null);
        setColunas(agrupar(tarefas));
      }}
      accessibility={{
        announcements: anuncios,
        screenReaderInstructions: {
          draggable:
            "Para mover uma tarefa, aperte espaço para pegar, use as setas para mudar de lugar ou de coluna, e espaço de novo para soltar. Esc cancela.",
        },
      }}
    >
      <div className="-mx-4 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8">
        <div className="grid min-w-[1080px] grid-cols-4 gap-4">
          {STATUS.map((s) => {
            const lista = colunas[s.valor];
            const visiveis =
              s.valor === "feito" && !feitasTodas
                ? [...lista].sort((a, b) => (b.concluido_em ?? "").localeCompare(a.concluido_em ?? "")).slice(0, LIMITE_FEITO).sort((a, b) => a.posicao - b.posicao)
                : lista;
            return (
              <Coluna
                key={s.valor}
                status={s.valor}
                rotulo={s.rotulo}
                total={lista.length}
                tarefas={visiveis}
                ocultas={lista.length - visiveis.length}
                semanaFiltro={semanaFiltro}
                podeEditar={podeEditar}
                arrastou={arrastou}
              />
            );
          })}
        </div>
      </div>
      <DragOverlay>{ativo ? <CartaoTarefa tarefa={ativo} arrastando /> : null}</DragOverlay>
    </DndContext>
  );
}

function Coluna({
  status,
  rotulo,
  total,
  tarefas,
  ocultas,
  semanaFiltro,
  podeEditar,
  arrastou,
}: {
  status: Status;
  rotulo: string;
  total: number;
  tarefas: TarefaResumo[];
  ocultas: number;
  semanaFiltro: number | null;
  podeEditar: boolean;
  arrastou: React.RefObject<boolean>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const params = useSearchParams();
  const caminho = usePathname();
  const verTodas = new URLSearchParams(params.toString());
  verTodas.set("feitas", "todas");

  return (
    <section aria-label={`${rotulo}, ${total} tarefas`} className="flex min-w-0 flex-col">
      <h2 className="mb-3 flex items-center gap-2 px-1">
        <span className="font-titulo text-[1rem] font-semibold text-texto">{rotulo}</span>
        <span className="t-dado text-[0.8125rem] text-texto-2">{total}</span>
      </h2>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-40 flex-1 flex-col gap-2.5 rounded-g bg-superficie-2/60 p-2.5 transition-colors duration-150",
          isOver && "bg-superficie-2",
        )}
      >
        <SortableContext items={tarefas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tarefas.map((t) => (
            <CartaoArrastavel key={t.id} tarefa={t} desabilitado={!podeEditar} arrastou={arrastou} />
          ))}
        </SortableContext>
        {ocultas > 0 && (
          <Link href={`${caminho}?${verTodas.toString()}`} className="link px-1 text-[0.875rem]">
            Ver todas ({ocultas} a mais)
          </Link>
        )}
        {podeEditar && <AdicionarNaColuna status={status} semana={semanaFiltro} />}
      </div>
    </section>
  );
}

function CartaoArrastavel({ tarefa, desabilitado, arrastou }: { tarefa: TarefaResumo; desabilitado: boolean; arrastou: React.RefObject<boolean> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tarefa.id, disabled: desabilitado });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="tarefa arrastável"
      onClickCapture={(e) => {
        if (arrastou.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={cn("touch-manipulation rounded-m outline-offset-2", isDragging && "opacity-40")}
    >
      <CartaoTarefa tarefa={tarefa} className="cursor-grab active:cursor-grabbing" />
    </div>
  );
}

function AdicionarNaColuna({ status, semana }: { status: Status; semana: number | null }) {
  const { avisar, semanaAtual } = usePainel();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [pendente, iniciar] = useTransition();
  if (!aberto)
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-auto inline-flex items-center gap-1.5 rounded-m px-2 py-2 text-[0.875rem] text-texto-2 hover:bg-superficie hover:text-texto"
      >
        <Plus aria-hidden strokeWidth={2} className="size-4" /> Adicionar tarefa
      </button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!titulo.trim()) return;
        iniciar(async () => {
          const r = await criarTarefa({ titulo, status, semana: semana ?? semanaAtual });
          if (!r.ok) avisar(r.erro, { erro: true });
          else {
            setTitulo("");
            router.refresh();
          }
        });
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        autoFocus
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
          if (e.key === "Escape") setAberto(false);
        }}
        rows={2}
        maxLength={200}
        placeholder="Título da tarefa"
        aria-label="Título da nova tarefa"
        className={cn(estiloControle, "resize-none py-2 text-[0.9375rem]")}
      />
      <div className="flex gap-2">
        <button type="submit" disabled={pendente} className="rounded-m bg-botao-primario px-3 py-1.5 text-[0.875rem] font-semibold text-botao-primario-texto hover:bg-botao-primario-hover">
          Adicionar
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-m px-3 py-1.5 text-[0.875rem] text-texto-2 hover:bg-superficie">
          Cancelar
        </button>
      </div>
    </form>
  );
}
