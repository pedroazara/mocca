"use client";

import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type Over,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS, getEventCoordinates } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { criarTarefa, moverTarefa } from "@/app/painel/acoes";
import { estiloControle } from "@/components/ui/campo";
import { agrupar, moverNasColunas, visiveis, vizinhos, type Colunas, type Movimento } from "@/lib/painel/quadro";
import { STATUS, rotuloStatus, type Status, type TarefaResumo } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { CartaoTarefa } from "./tarefa-pecas";

// Quadro (seção 9.3, DUVIDAS 4q): A fazer · Fazendo · Em revisão · Feito.
// Arrastar entre colunas muda o status; dentro da coluna, a ordem. Mouse, toque
// e teclado (espaço pega, setas movem, espaço solta).
//
// Durante o arrasto, a tela mexe numa cópia das colunas (`arrasto`). Ao soltar,
// o movimento entra como atualização otimista e fica na tela até o servidor
// gravar e devolver as tarefas: o cartão não volta para o lugar antigo nesse
// meio-tempo, nem quando dois movimentos seguidos ainda estão a caminho. O
// servidor recebe os vizinhos (o cartão de cima e o de baixo) e calcula a posição.

const ehColuna = (id: UniqueIdentifier) => STATUS.some((s) => s.valor === id);

// Altura de referência do arrasto: o ponteiro (mouse e toque) ou, no teclado,
// o meio do cartão arrastado.
function alturaDoArrasto(e: { active: Active; activatorEvent: Event; delta: { y: number } }) {
  const p = getEventCoordinates(e.activatorEvent);
  if (p) return p.y + e.delta.y;
  const r = e.active.rect.current.translated;
  return r ? r.top + r.height / 2 : null;
}

// Setas ← e → no teclado: vão para a coluna vizinha, no cartão mais perto da
// mesma altura (ou no topo da coluna vazia). As do dnd-kit comparavam a borda
// esquerda do cartão arrastado, que fica inclinado e sai um pouco da coluna: a
// primeira seta para a direita descia o cartão na própria coluna. ↑ e ↓ seguem
// as do dnd-kit. A coluna de cada cartão vem do SortableContext (id = status).
const setasDoQuadro: KeyboardCoordinateGetter = (event, args) => {
  const lado = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (!lado) return sortableKeyboardCoordinates(event, args);
  event.preventDefault();
  const { active, collisionRect, droppableRects, droppableContainers } = args.context;
  if (!active || !collisionRect) return;
  const colunaDoCartao = (c: { id: UniqueIdentifier; data: { current?: Record<string, unknown> } }) =>
    ehColuna(c.id) ? undefined : (c.data.current?.sortable as { containerId?: UniqueIdentifier } | undefined)?.containerId;
  const atual = colunaDoCartao(active);
  const alvo = STATUS[STATUS.findIndex((s) => s.valor === atual) + lado]?.valor;
  if (!atual || !alvo) return;
  const cartoes = droppableContainers
    .getEnabled()
    .filter((c) => c.id !== active.id && colunaDoCartao(c) === alvo)
    .map((c) => droppableRects.get(c.id))
    .filter((r) => r !== undefined);
  const rect = cartoes.length
    ? cartoes.reduce((perto, r) => (Math.abs(r.top - collisionRect.top) < Math.abs(perto.top - collisionRect.top) ? r : perto))
    : droppableRects.get(alvo);
  return rect ? { x: rect.left, y: rect.top } : undefined;
};

// Passou do cartão inteiro (o vão embaixo do último cartão da coluna).
const passouDe = (y: number | null, over: Over) => y !== null && y > over.rect.top + over.rect.height;

export function Kanban({ tarefas, semanaFiltro, feitasTodas }: { tarefas: TarefaResumo[]; semanaFiltro: number | null; feitasTodas: boolean }) {
  const { avisar, podeEditar } = usePainel();
  const base = useMemo(() => agrupar(tarefas), [tarefas]);
  const [otimista, aplicar] = useOptimistic(base, moverNasColunas);
  const [arrasto, setArrasto] = useState<Colunas | null>(null);
  const colunas = arrasto ?? otimista;
  const [ativo, setAtivo] = useState<TarefaResumo | null>(null);
  const origem = useRef<Movimento | null>(null);
  const arrastou = useRef(false);
  const [, iniciar] = useTransition();

  // id estável: sem ele, o dnd-kit gera ids diferentes no servidor e no navegador
  const idDnd = useId();
  // No toque, segurar um instante antes de arrastar: com o arrasto imediato, o
  // navegador começava a rolar o quadro e cancelava o movimento.
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    // Espaço pega e solta; o Enter fica para abrir a tarefa (CartaoArrastavel)
    useSensor(KeyboardSensor, {
      coordinateGetter: setasDoQuadro,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const colunaDe = (id: UniqueIdentifier, c: Colunas = colunas): Status | undefined => {
    if (ehColuna(id)) return id as Status;
    return (Object.keys(c) as Status[]).find((s) => c[s].some((t) => t.id === id));
  };
  const tituloDe = (id: UniqueIdentifier) => {
    for (const s of Object.keys(colunas) as Status[]) {
      const t = colunas[s].find((x) => x.id === id);
      if (t) return t.titulo;
    }
    return "tarefa";
  };
  const mostrar = (s: Status, c: Colunas = colunas) => visiveis(s, c[s], feitasTodas);

  // Quem manda é o ponteiro: a coluna embaixo dele e, nela, o cartão embaixo
  // dele ou o mais perto. Antes, valiam os cantos do cartão arrastado, e o lugar
  // em que ele caía dependia de onde tinha sido pego. No teclado (sem ponteiro),
  // continua a regra dos cantos, que é a que as setas usam.
  const colisao: CollisionDetection = (args) => {
    if (!args.pointerCoordinates) return closestCorners(args);
    const sob = pointerWithin(args);
    const cartao = sob.find((c) => !ehColuna(c.id));
    if (cartao) return [cartao];
    const coluna =
      sob.find((c) => ehColuna(c.id))?.id ??
      closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((d) => ehColuna(d.id)) })[0]?.id;
    if (!coluna) return [];
    const daColuna = args.droppableContainers.filter((d) => !ehColuna(d.id) && colunaDe(d.id) === coluna);
    if (!daColuna.length) return [{ id: coluna }];
    return closestCenter({ ...args, droppableContainers: daColuna }).slice(0, 1);
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
    const id = String(e.active.id);
    const s = colunaDe(id)!;
    origem.current = { id, status: s, ...vizinhos(mostrar(s), id) };
    arrastou.current = true;
    setArrasto(colunas);
    setAtivo(colunas[s].find((x) => x.id === id) ?? null);
  }

  // Passar para outra coluna: o cartão entra no lugar do cartão sob o ponteiro,
  // ou depois dele se o ponteiro já passou do cartão (no vão do fim da coluna).
  // Dali em diante, como dentro de uma coluna só, quem mostra o lugar é o
  // SortableContext, e o `fim` grava exatamente o lugar mostrado.
  function sobre(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const de = colunaDe(active.id);
    const para = colunaDe(over.id);
    if (!de || !para || de === para) return;
    const abaixo = passouDe(alturaDoArrasto(e), over);
    setArrasto((c) => {
      const item = c?.[de].find((t) => t.id === active.id);
      if (!c || !item) return c;
      const destino = c[para].filter((t) => t.id !== active.id);
      const i = destino.findIndex((t) => t.id === over.id);
      destino.splice(i < 0 ? destino.length : abaixo ? i + 1 : i, 0, { ...item, status: para, concluido_em: null });
      return { ...c, [de]: c[de].filter((t) => t.id !== active.id), [para]: destino };
    });
  }

  // Desfazer: a tarefa volta para a coluna e os vizinhos de antes.
  function mover(m: Movimento) {
    iniciar(async () => {
      aplicar(m);
      const r = await moverTarefa(m.id, m.status, m);
      if (!r.ok) avisar(r.erro, { erro: true });
    });
  }

  function fim(e: DragEndEvent) {
    const { active, over } = e;
    const c = arrasto;
    const o = origem.current;
    origem.current = null;
    setAtivo(null);
    setArrasto(null);
    window.setTimeout(() => (arrastou.current = false), 50);
    if (!over || !c || !o) return;
    const id = String(active.id);
    const s = colunaDe(id, c)!;
    let lista = mostrar(s, c);
    const de = lista.findIndex((t) => t.id === id);
    const para = !ehColuna(over.id) && colunaDe(over.id, c) === s ? lista.findIndex((t) => t.id === over.id) : de;
    if (para >= 0 && para !== de) lista = arrayMove(lista, de, para);
    const m: Movimento = { id, status: s, ...vizinhos(lista, id) };
    if (m.status === o.status && m.antes === o.antes && m.depois === o.depois) return;
    iniciar(async () => {
      aplicar(m);
      const r = await moverTarefa(id, s, m);
      if (!r.ok) avisar(r.erro, { erro: true });
      else if (s !== o.status) avisar(`Movida para ${rotuloStatus(s)}.`, { desfazer: () => mover(o) });
    });
  }

  return (
    <DndContext
      id={idDnd}
      sensors={sensores}
      collisionDetection={colisao}
      // as colunas mudam de altura quando um cartão passa de uma para outra
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={inicio}
      onDragOver={sobre}
      onDragEnd={fim}
      onDragCancel={() => {
        origem.current = null;
        setAtivo(null);
        setArrasto(null);
      }}
      accessibility={{
        announcements: anuncios,
        screenReaderInstructions: {
          draggable:
            "Enter abre a tarefa. Para mover, aperte espaço para pegar, use as setas para mudar de lugar ou de coluna, e espaço de novo para soltar. Esc cancela.",
        },
      }}
    >
      <div className="-mx-4 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8">
        <div className="grid min-w-[860px] grid-cols-4 gap-4">
          {STATUS.map((s) => {
            const lista = colunas[s.valor];
            const vistas = mostrar(s.valor);
            return (
              <Coluna
                key={s.valor}
                status={s.valor}
                rotulo={s.rotulo}
                total={lista.length}
                tarefas={vistas}
                ocultas={lista.length - vistas.length}
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
        <SortableContext id={status} items={tarefas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tarefas.map((t) => (
            <CartaoArrastavel key={t.id} tarefa={t} desabilitado={!podeEditar} arrastou={arrastou} />
          ))}
        </SortableContext>
        {tarefas.length === 0 && (
          // coluna vazia: diz o que fazer em vez de só mostrar um vão
          <p
            className={cn(
              "rounded-m border border-dashed px-3 py-6 text-center text-[0.8125rem] text-texto-2 transition-colors duration-150",
              isOver ? "border-caramelo bg-caramelo/10 text-texto" : "border-linha",
            )}
          >
            {podeEditar ? "Arraste uma tarefa para cá" : "Nenhuma tarefa"}
          </p>
        )}
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

// O cartão inteiro é o botão do teclado: Enter abre a tarefa, espaço pega. O
// link do título fica fora do Tab, para não haver um controle dentro do outro.
function CartaoArrastavel({ tarefa, desabilitado, arrastou }: { tarefa: TarefaResumo; desabilitado: boolean; arrastou: React.RefObject<boolean> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tarefa.id, disabled: desabilitado });
  const router = useRouter();
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !isDragging && e.target === e.currentTarget) {
          e.preventDefault();
          router.push(`/painel/tarefas/${tarefa.id}`, { scroll: false });
        }
      }}
      aria-label={tarefa.titulo}
      aria-roledescription="tarefa arrastável"
      onClickCapture={(e) => {
        if (arrastou.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={cn("touch-manipulation rounded-m outline-offset-2 [-webkit-touch-callout:none]", isDragging && "opacity-40")}
    >
      <CartaoTarefa tarefa={tarefa} foraDoTab className="cursor-grab active:cursor-grabbing" />
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
