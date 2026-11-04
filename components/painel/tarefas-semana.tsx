"use client";

import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type ClientRect,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";
import { CalendarArrowRight, Check, ChevronDown, GripVertical, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { atualizarTarefa, moverParaSemana } from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { diaCurto, estaAtrasada } from "@/lib/painel/datas";
import type { Item, Semana, Status, TarefaResumo } from "@/lib/painel/tipos";
import { rotuloStatus } from "@/lib/painel/tipos";
import { cn, plural } from "@/lib/utils";
import { usePainel } from "./contexto";
import { Avatar, ChipAtrasada, ChipEtiqueta, PilhaAvatares, Prazo } from "./elementos";
import { EVENTO_NOVA_TAREFA } from "./paleta";
import { ItemMarcavel } from "./tarefa-pecas";

// "Tarefas da semana" (seção 9.1): uma linha por tarefa, com o anel dos passos
// feitos, o prazo, as etiquetas e quem participa. Os passos (itens) ficam
// recolhidos e abrem ali mesmo, marcáveis: a tela mostra o tamanho da semana
// sem despejar todos os itens de uma vez (DUVIDAS 4l).
//
// Passar de semana (DUVIDAS 4m): arrastar a linha abre embaixo a barra das 12
// semanas; ao soltar, o cartão voa até a semana, que pula com um "+1". O botão
// do calendário passa para a semana seguinte, e a linha desliza para a direita.
// Na semana de destino, a tarefa chega destacada. O prazo vai junto.

const estadoStatus = { fazendo: "info", em_revisao: "alerta" } as const;

// a tarefa que acabou de passar de semana, para chegar destacada do outro lado
const CHAVE_CHEGADA = "mocca:tarefa-chegou";
// avisa a seta "próxima semana" do topo para pular com o "+1"
export const EVENTO_PASSOU_SEMANA = "mocca:passou-semana";

type Passo = Item & { pessoa_id: string };
type Retangulo = Pick<ClientRect, "top" | "left" | "width" | "height">;

const passosDa = (t: TarefaResumo): Passo[] =>
  t.atribuicoes.flatMap((a) => a.itens.map((i) => ({ ...i, pessoa_id: a.pessoa_id })));

const semMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// O cartão arrastado é menor que a linha e vai logo acima do ponteiro, para
// não cobrir a semana em que ele vai cair.
const cartaoNoPonteiro: Modifier = ({ activatorEvent, activeNodeRect, overlayNodeRect, transform, windowRect }) => {
  const p = activatorEvent && getEventCoordinates(activatorEvent);
  if (!p || !activeNodeRect || !overlayNodeRect) return transform;
  const x = transform.x + p.x - activeNodeRect.left - overlayNodeRect.width / 2;
  // sem sair pelas bordas da tela (no celular o cartão é quase da largura dela)
  const largura = windowRect?.width ?? window.innerWidth;
  const minimo = 8 - activeNodeRect.left;
  const maximo = largura - 8 - overlayNodeRect.width - activeNodeRect.left;
  return {
    ...transform,
    x: Math.min(Math.max(x, minimo), Math.max(minimo, maximo)),
    y: transform.y + p.y - activeNodeRect.top - overlayNodeRect.height - 14,
  };
};

// A barra das semanas nasce quando o arrasto começa e entra subindo: as semanas
// são medidas de novo a cada 100 ms enquanto o ponteiro anda, e quem decide
// onde a tarefa cai é a posição do ponteiro, não o tamanho do cartão.
const medicao = { droppable: { strategy: MeasuringStrategy.Always, frequency: 100 } };

// Um clique, uma tarefa: enquanto a linha sai, a de baixo sobe para baixo do
// ponteiro (com movimento reduzido, na hora), e o segundo clique de um duplo
// clique passaria a vizinha junto. Os botões também ignoram o clique que já
// é o segundo (e.detail > 1).
export function useUmDeCadaVez(ms = 700) {
  const ate = useRef(0);
  return () => {
    const agora = performance.now();
    if (agora < ate.current) return false;
    ate.current = agora + ms;
    return true;
  };
}

// Quem passou a tarefa pelo teclado não perde o lugar quando a linha some: o
// foco vai para a linha vizinha, ou para o título da seção se era a última.
export function focarVizinha(linha: HTMLElement | null | undefined, idTitulo: string) {
  if (!linha?.contains(document.activeElement)) return;
  const vizinha = linha.nextElementSibling ?? linha.previousElementSibling;
  const alvo = vizinha?.querySelector<HTMLElement>("a[href]") ?? document.getElementById(idTitulo);
  alvo?.focus({ preventScroll: true });
}

// A barra, o cartão arrastado e o voo vão direto para o <body>: dentro do
// painel (que isola as camadas) eles ficariam embaixo dos avisos. No servidor
// não há <body>, e eles só existem no navegador.
const semAssinatura = () => () => {};
const useNoNavegador = () =>
  useSyncExternalStore(
    semAssinatura,
    () => true,
    () => false,
  );

export function lembrarChegada(id: string) {
  try {
    sessionStorage.setItem(CHAVE_CHEGADA, JSON.stringify({ id, ate: Date.now() + 30000 }));
  } catch {
    // sem sessionStorage (janela privada), só não há destaque na chegada
  }
}

function lerChegada(): string | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE_CHEGADA) ?? "null") as { id: string; ate: number } | null;
    return v && v.ate > Date.now() ? v.id : null;
  } catch {
    return null;
  }
}

// A linha sai da lista: desliza para a direita (rumo à próxima semana) ou para
// a esquerda (da Atenção para a lista desta semana), ou só encolhe (o cartão
// já voou para a barra). Resolve quando a animação acaba.
export function animarSaida(el: HTMLElement | null | undefined, tipo: "direita" | "esquerda" | "encolher") {
  if (!el || semMovimento()) return Promise.resolve();
  const altura = `${el.offsetHeight}px`;
  el.style.overflow = "hidden";
  const fim = { height: "0px", paddingTop: "0px", paddingBottom: "0px", opacity: 0 };
  const desvio = tipo === "direita" ? "64px" : "-64px";
  const quadros: Keyframe[] =
    tipo === "encolher"
      ? [{ opacity: 0.35, height: altura }, fim]
      : [
          { transform: "translateX(0)", opacity: 1, height: altura },
          { transform: `translateX(${desvio})`, opacity: 0, height: altura, offset: 0.55 },
          { transform: `translateX(${desvio})`, ...fim },
        ];
  const a = el.animate(quadros, {
    duration: tipo === "encolher" ? 320 : 560,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    fill: "forwards",
  });
  return a.finished.then(
    () => undefined,
    () => undefined,
  );
}

export function TarefasDaSemana({
  tarefas,
  semana,
  todas,
}: {
  tarefas: TarefaResumo[];
  semana: Semana;
  todas: TarefaResumo[];
}) {
  const { podeEditar, avisar } = usePainel();
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set());
  const [ocultas, ocultar] = useOptimistic<string[], string>([], (lista, id) => [...lista, id]);
  const [, iniciar] = useTransition();
  const [ativa, setAtiva] = useState<TarefaResumo | null>(null);
  const [barra, setBarra] = useState<"fechada" | "aberta" | "fechando">("fechada");
  const [voo, setVoo] = useState<{ de: Retangulo; para: Retangulo; tarefa: TarefaResumo; numero: number } | null>(null);
  const [recebeu, setRecebeu] = useState<{ numero: number; vez: number } | null>(null);
  const [chegou, setChegou] = useState<string | null>(null);
  const linhas = useRef(new Map<string, HTMLLIElement>());
  const cartao = useRef<HTMLDivElement>(null);
  const relogio = useRef<number | undefined>(undefined);
  // durante o arrasto (e um instante depois, para engolir o clique do soltar)
  const arrastando = useRef(false);
  const arrastou = useRef(false);
  const umDeCadaVez = useUmDeCadaVez();
  const noNavegador = useNoNavegador();
  const idDnd = useId();

  const visiveis = tarefas.filter((t) => !ocultas.includes(t.id));
  // "mostrar todos" abre as que ainda têm o que fazer; as feitas ficam fechadas
  const comPassos = visiveis.filter((t) => t.status !== "feito" && passosDa(t).length > 0).map((t) => t.id);
  const todasAbertas = comPassos.length > 0 && comPassos.every((id) => abertas.has(id));

  // a tarefa que acabou de chegar (de outra semana ou de volta pelo Desfazer)
  const ids = visiveis.map((t) => t.id).join(",");
  useEffect(() => {
    const id = lerChegada();
    if (!id || !ids.split(",").includes(id)) return;
    try {
      sessionStorage.removeItem(CHAVE_CHEGADA);
    } catch {}
    setChegou(id);
    linhas.current.get(id)?.scrollIntoView({ block: "nearest", behavior: semMovimento() ? "auto" : "smooth" });
    window.setTimeout(() => setChegou((c) => (c === id ? null : c)), 2600);
  }, [ids]);

  useEffect(() => () => window.clearTimeout(relogio.current), []);

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // no toque, segurar um instante: assim a rolagem continua funcionando
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const alternar = (id: string) =>
    setAbertas((a) => {
      const nova = new Set(a);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });

  function fecharBarra(depois = 0) {
    window.clearTimeout(relogio.current);
    relogio.current = window.setTimeout(() => {
      setBarra("fechando");
      relogio.current = window.setTimeout(() => setBarra("fechada"), semMovimento() ? 0 : 240);
    }, depois);
  }

  async function passar(t: TarefaResumo, numero: number, saida: "direita" | "encolher") {
    const linha = linhas.current.get(t.id);
    await animarSaida(linha, saida);
    focarVizinha(linha, "tarefas-semana");
    lembrarChegada(t.id);
    iniciar(async () => {
      ocultar(t.id);
      const r = await moverParaSemana(t.id, numero);
      if (!r.ok) {
        avisar(r.erro, { erro: true });
        return;
      }
      avisar(`Tarefa passou para a semana ${numero}.`, {
        desfazer: () => {
          lembrarChegada(t.id);
          void atualizarTarefa(t.id, { semana: semana.numero, prazo: t.prazo });
        },
      });
    });
  }

  function proximaSemana(t: TarefaResumo) {
    if (!umDeCadaVez()) return;
    window.dispatchEvent(new CustomEvent(EVENTO_PASSOU_SEMANA, { detail: { numero: semana.numero + 1 } }));
    void passar(t, semana.numero + 1, "direita");
  }

  // Depois de um arrasto o navegador ainda manda o clique do soltar; no título,
  // ele abriria a tarefa numa página inteira em vez da janela.
  const soltou = () => {
    arrastando.current = false;
    window.setTimeout(() => (arrastou.current = false), 50);
  };

  function inicio(e: DragStartEvent) {
    arrastando.current = true;
    arrastou.current = true;
    window.clearTimeout(relogio.current);
    setAtiva(tarefas.find((t) => t.id === e.active.id) ?? null);
    setBarra("aberta");
  }

  function fim(e: DragEndEvent) {
    soltou();
    const t = ativa;
    setAtiva(null);
    const numero = e.over?.data.current?.numero as number | undefined;
    const de = cartao.current?.getBoundingClientRect();
    if (!t || !numero || numero === semana.numero || !e.over) {
      fecharBarra();
      return;
    }
    if (de && !semMovimento()) setVoo({ de, para: e.over.rect, tarefa: t, numero });
    else pousou(numero);
    void passar(t, numero, "encolher");
  }

  function pousou(numero: number) {
    setVoo(null);
    setRecebeu({ numero, vez: Date.now() });
    // se outra tarefa já está sendo arrastada, quem fecha a barra é o fim dela
    if (!arrastando.current) fecharBarra(700);
  }

  const tituloDe = (id: string | number) => tarefas.find((t) => t.id === id)?.titulo ?? "tarefa";
  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Tarefa "${tituloDe(active.id)}" pega. Solte numa das semanas da barra embaixo.`,
    onDragOver: ({ over }) => (over ? `Sobre a semana ${over.data.current?.numero}.` : "Fora das semanas."),
    onDragEnd: ({ active, over }) =>
      over ? `"${tituloDe(active.id)}" passou para a semana ${over.data.current?.numero}.` : "Nada mudou.",
    onDragCancel: () => "Nada mudou.",
  };

  const lista = (
    <ul
      className="flex flex-col divide-y divide-linha overflow-hidden rounded-g border border-linha bg-superficie"
      onClickCapture={(e) => {
        if (!arrastou.current) return;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {visiveis.map((t) => (
        <LinhaTarefaSemana
          key={t.id}
          tarefa={t}
          aberta={abertas.has(t.id)}
          alternar={() => alternar(t.id)}
          arrastando={ativa?.id === t.id}
          chegou={chegou === t.id}
          proxima={podeEditar && semana.numero < 12 && t.status !== "feito" ? () => proximaSemana(t) : undefined}
          numeroProxima={semana.numero + 1}
          podeArrastar={podeEditar}
          registrar={(el) => {
            if (el) linhas.current.set(t.id, el);
            else linhas.current.delete(t.id);
          }}
        />
      ))}
    </ul>
  );

  const corpo = visiveis.length ? (
    lista
  ) : (
    <div className="flex flex-col items-center gap-3 rounded-m border border-dashed border-linha px-6 py-10 text-center">
      <p className="max-w-[40ch] text-texto-2">Nenhuma tarefa nesta semana.</p>
      {podeEditar && (
        <Botao variante="secundario" tamanho="painel" onClick={() => window.dispatchEvent(new Event(EVENTO_NOVA_TAREFA))}>
          <Plus aria-hidden />
          Nova tarefa
        </Botao>
      )}
    </div>
  );

  return (
    <section aria-labelledby="tarefas-semana">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="tarefas-semana" tabIndex={-1} className="t-rotulo text-texto-2">
          Tarefas da semana {visiveis.length > 0 && <span className="t-dado">({visiveis.length})</span>}
        </h2>
        {comPassos.length > 1 && (
          <button
            type="button"
            onClick={() => setAbertas(todasAbertas ? new Set() : new Set(comPassos))}
            className="link text-[0.875rem]"
          >
            {todasAbertas ? "Recolher os passos" : "Mostrar todos os passos"}
          </button>
        )}
      </div>
      {podeEditar ? (
        // montado mesmo sem tarefas: quando a última sai, a barra ainda recebe o voo
        <DndContext
          id={idDnd}
          sensors={sensores}
          collisionDetection={pointerWithin}
          measuring={medicao}
          onDragStart={inicio}
          onDragEnd={fim}
          onDragCancel={() => {
            soltou();
            setAtiva(null);
            fecharBarra();
          }}
          accessibility={{
            announcements: anuncios,
            screenReaderInstructions: {
              draggable: "Para passar a tarefa de semana pelo teclado, use o botão do calendário na linha da tarefa.",
            },
          }}
        >
          {corpo}
          {noNavegador &&
            createPortal(
              <div className="text-[0.9375rem] leading-[1.5]">
                <DragOverlay dropAnimation={null} modifiers={[cartaoNoPonteiro]} style={{ width: "auto", height: "auto" }}>
                  {ativa && <CartaoVoando ref={cartao} tarefa={ativa} />}
                </DragOverlay>
                {barra !== "fechada" && (
                  <BarraSemanas semana={semana} todas={todas} fechando={barra === "fechando"} recebeu={recebeu} />
                )}
                {voo && <Voo {...voo} aoChegar={() => pousou(voo.numero)} />}
              </div>,
              document.body,
            )}
        </DndContext>
      ) : (
        corpo
      )}
    </section>
  );
}

function LinhaTarefaSemana({
  tarefa: t,
  aberta,
  alternar,
  arrastando,
  chegou,
  proxima,
  numeroProxima,
  podeArrastar,
  registrar,
}: {
  tarefa: TarefaResumo;
  aberta: boolean;
  alternar: () => void;
  arrastando: boolean;
  chegou: boolean;
  proxima?: () => void;
  numeroProxima: number;
  podeArrastar: boolean;
  registrar: (el: HTMLLIElement | null) => void;
}) {
  const { pessoa, etiqueta, podeEditar, avisar } = usePainel();
  const idPassos = useId();
  const { setNodeRef, listeners } = useDraggable({ id: t.id, disabled: !podeArrastar });
  const [passos, marcarPasso] = useOptimistic(passosDa(t), (atual, m: { id: string; feito: boolean }) =>
    atual.map((p) => (p.id === m.id ? { ...p, feito: m.feito } : p)),
  );
  const [status, setStatus] = useOptimistic<Status>(t.status);
  const [concluindo, iniciar] = useTransition();
  const feitos = passos.filter((p) => p.feito).length;
  const total = passos.length;
  const feita = status === "feito";
  const atrasada = estaAtrasada({ prazo: t.prazo, status });

  const concluir = () =>
    iniciar(async () => {
      setStatus("feito");
      const r = await atualizarTarefa(t.id, { status: "feito" });
      if (!r.ok) avisar(r.erro, { erro: true });
      else avisar("Tarefa feita.", { desfazer: () => atualizarTarefa(t.id, { status: t.status }) });
    });

  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        registrar(el);
      }}
      {...(podeArrastar ? listeners : {})}
      className={cn(
        "group relative flex gap-3 px-4 py-3.5 transition-opacity duration-150 [-webkit-touch-callout:none]",
        podeArrastar && "cursor-grab active:cursor-grabbing",
        arrastando && "opacity-40",
        chegou && "animate-[mocca-chegou_2.4s_var(--ease-saida)]",
      )}
    >
      {podeArrastar && (
        <GripVertical
          aria-hidden
          strokeWidth={1.75}
          className="absolute top-1/2 left-0.5 size-3.5 -translate-y-1/2 text-texto-2 opacity-0 transition-opacity duration-150 group-hover:opacity-60"
        />
      )}
      {total > 0 && !feita ? (
        // atalho de mouse para os passos; o botão acessível é o "0 de 8 passos"
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={alternar}
          title={aberta ? "Recolher os passos" : "Mostrar os passos"}
          className="self-start rounded-full"
        >
          <AnelPassos feitos={feitos} total={total} feita={feita} />
        </button>
      ) : (
        <AnelPassos feitos={feitos} total={total} feita={feita} />
      )}
      <div className="min-w-0 flex-1">
        <Link
          href={`/painel/tarefas/${t.id}`}
          scroll={false}
          draggable={false}
          className={cn("font-medium hover:underline", feita ? "text-texto-2" : "text-texto")}
        >
          {t.titulo}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-texto-2">
          {atrasada && <ChipAtrasada />}
          {(status === "fazendo" || status === "em_revisao") && (
            <Chip estado={estadoStatus[status]}>{rotuloStatus(status).toLowerCase()}</Chip>
          )}
          {total > 0 && (
            <button
              type="button"
              onClick={alternar}
              aria-expanded={aberta}
              aria-controls={idPassos}
              className="relative inline-flex items-center gap-1 rounded-p text-[0.8125rem] text-texto-2 transition-colors duration-150 after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-[''] hover:text-texto"
            >
              <ChevronDown
                aria-hidden
                strokeWidth={1.75}
                className={cn("size-4 transition-transform duration-150", aberta && "rotate-180")}
              />
              <span>
                <span className="t-dado">{feitos}</span> de <span className="t-dado">{total}</span>{" "}
                {total === 1 ? "passo" : "passos"}
              </span>
            </button>
          )}
          <Prazo prazo={t.prazo} status={status} curto />
          {t.etiquetas.map((e) => (
            <ChipEtiqueta key={e} etiqueta={etiqueta(e)} />
          ))}
          <span className="ml-auto flex items-center gap-2">
            <PilhaAvatares pessoas={t.atribuicoes.map((a) => pessoa(a.pessoa_id))} />
            {proxima && (
              <button
                type="button"
                onClick={(e) => {
                  if (e.detail < 2) proxima();
                }}
                aria-label={`Passar “${t.titulo}” para a semana ${numeroProxima}`}
                title={`Passar para a semana ${numeroProxima}`}
                className="relative -my-1 rounded-p p-1 text-texto-2 transition-[opacity,color,background-color] duration-150 after:absolute after:-inset-2 after:content-[''] hover:bg-superficie-2 hover:text-texto focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0"
              >
                <CalendarArrowRight aria-hidden strokeWidth={1.75} className="size-4" />
              </button>
            )}
          </span>
        </div>

        {aberta && total > 0 && (
          <div id={idPassos} className="mt-3 flex flex-col gap-1 border-t border-linha pt-3">
            {passos.map((p) => (
              <div key={p.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <ItemMarcavel item={p} aoMarcar={(feito) => marcarPasso({ id: p.id, feito })} />
                </div>
                <Avatar pessoa={pessoa(p.pessoa_id)} tamanho={20} className="mt-px" />
              </div>
            ))}
            {feitos === total && !feita && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-m bg-ok-fundo px-3 py-2 text-[0.875rem] text-ok">
                <Check aria-hidden strokeWidth={2} className="size-4 shrink-0" />
                <span className="flex-1">Todos os passos feitos.</span>
                {podeEditar && (
                  <Botao variante="secundario" tamanho="painel" className="h-8 bg-superficie" disabled={concluindo} onClick={concluir}>
                    Marcar a tarefa como feita
                  </Botao>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// O cartão que acompanha o ponteiro enquanto a tarefa é arrastada.
function CartaoVoando({ tarefa: t, ref }: { tarefa: TarefaResumo; ref?: React.Ref<HTMLDivElement> }) {
  const { pessoa } = usePainel();
  const passos = passosDa(t);
  return (
    <div
      ref={ref}
      className="flex w-[min(420px,80vw)] rotate-[1.5deg] cursor-grabbing items-start gap-3 rounded-m border border-caramelo/60 bg-superficie px-4 py-3 shadow-flutuante"
    >
      <AnelPassos feitos={passos.filter((p) => p.feito).length} total={passos.length} feita={t.status === "feito"} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-medium text-texto">{t.titulo}</p>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <Prazo prazo={t.prazo} status={t.status} curto />
          <PilhaAvatares pessoas={t.atribuicoes.map((a) => pessoa(a.pessoa_id))} />
        </div>
      </div>
    </div>
  );
}

// Depois de soltar: o cartão faz um arco até a semana e encolhe dentro dela.
function Voo({
  de,
  para,
  tarefa,
  aoChegar,
}: {
  de: Retangulo;
  para: Retangulo;
  tarefa: TarefaResumo;
  aoChegar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chegar = useRef(aoChegar);
  chegar.current = aoChegar;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dx = para.left + para.width / 2 - (de.left + de.width / 2);
    const dy = para.top + para.height / 2 - (de.top + de.height / 2);
    const a = el.animate(
      [
        { transform: "translate(0, 0) scale(1) rotate(1.5deg)", opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 40}px) scale(0.5) rotate(-4deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.08) rotate(-10deg)`, opacity: 0.4 },
      ],
      { duration: 520, easing: "cubic-bezier(0.45, 0, 0.2, 1)", fill: "forwards" },
    );
    // no modo estrito do React o efeito roda duas vezes: a primeira animação é
    // cancelada e não pode encerrar o voo
    let vivo = true;
    a.finished.then(
      () => vivo && chegar.current(),
      () => undefined,
    );
    return () => {
      vivo = false;
      a.cancel();
    };
  }, [de, para]);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed z-[70] origin-center"
      style={{ top: de.top, left: de.left, width: de.width }}
    >
      <CartaoVoando tarefa={tarefa} />
    </div>
  );
}

// Barra das 12 semanas, embaixo da tela, enquanto uma tarefa é arrastada.
function BarraSemanas({
  semana,
  todas,
  fechando,
  recebeu,
}: {
  semana: Semana;
  todas: TarefaResumo[];
  fechando: boolean;
  recebeu: { numero: number; vez: number } | null;
}) {
  const { semanas, semanaAtual } = usePainel();
  const abertas = (n: number) => todas.filter((t) => t.semana === n && t.status !== "feito").length;
  return (
    // acima dos avisos (z-60), que também ficam embaixo, à direita: por isso
    // ela é desenhada direto no <body> (useNoNavegador, lá em cima)
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[65] flex justify-center px-3 lg:bottom-6">
      <div
        className={cn(
          "pointer-events-auto w-full max-w-[760px] rounded-g border border-linha bg-superficie/95 p-3 shadow-flutuante backdrop-blur-[8px]",
          fechando
            ? "animate-[mocca-descer_240ms_ease-in_forwards]"
            : "animate-[mocca-subir_320ms_var(--ease-saida)]",
        )}
      >
        <p className="t-rotulo mb-2 px-1 text-texto-2">Solte numa semana para passar a tarefa</p>
        <div className="grid grid-cols-6 gap-1.5 md:grid-cols-12">
          {semanas.map((s) => (
            <AlvoSemana
              key={s.id}
              semana={s}
              desta={s.numero === semana.numero}
              hoje={s.numero === semanaAtual}
              abertas={abertas(s.numero)}
              recebeu={recebeu?.numero === s.numero ? recebeu.vez : null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AlvoSemana({
  semana: s,
  desta,
  hoje,
  abertas,
  recebeu,
}: {
  semana: Semana;
  desta: boolean;
  hoje: boolean;
  abertas: number;
  recebeu: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `semana-${s.numero}`, data: { numero: s.numero }, disabled: desta });
  return (
    <div
      ref={setNodeRef}
      title={`Semana ${s.numero}: ${diaCurto(s.inicio)} a ${diaCurto(s.fim)} · ${plural(abertas, "tarefa aberta", "tarefas abertas")}`}
      className={cn(
        "relative flex h-[60px] flex-col items-center justify-center rounded-m border transition-[transform,background-color,border-color] duration-150 ease-out",
        desta ? "border-dashed border-linha opacity-45" : "border-linha bg-superficie-2",
        isOver && "scale-110 border-caramelo bg-caramelo/15",
        hoje && !isOver && !desta && "border-caramelo/60",
      )}
    >
      <span
        key={`semana-${recebeu ?? "parada"}`}
        className={cn(
          "flex flex-col items-center",
          recebeu && "animate-[mocca-receber_520ms_var(--ease-saida)]",
        )}
      >
        <span className="font-titulo text-[0.9375rem] leading-tight font-semibold text-texto">S{s.numero}</span>
        <span className="t-dado text-[0.6875rem] leading-tight text-texto-2">{diaCurto(s.inicio)}</span>
        {desta ? (
          <span className="t-dado mt-0.5 text-[0.625rem] leading-tight text-texto-2">esta</span>
        ) : (
          // uma bolinha por tarefa aberta, até 5
          <span aria-hidden className="mt-1 flex h-1.5 items-center gap-0.5">
            {Array.from({ length: Math.min(abertas, 5) }, (_, i) => (
              <span key={i} className="size-1 rounded-full bg-caramelo" />
            ))}
            {abertas > 5 && <span className="t-dado text-[0.5625rem] leading-none text-caramelo">+</span>}
          </span>
        )}
      </span>
      {recebeu && (
        <span
          key={`mais-${recebeu}`}
          aria-hidden
          className="t-dado pointer-events-none absolute -top-1 left-1/2 animate-[mocca-mais-um_900ms_ease-out_forwards] rounded-full bg-caramelo px-1.5 text-[0.6875rem] font-semibold text-botao-primario-texto opacity-0"
        >
          +1
        </span>
      )}
    </div>
  );
}

// Anel do progresso dos passos; a tarefa feita vira um círculo com o visto.
function AnelPassos({ feitos, total, feita }: { feitos: number; total: number; feita: boolean }) {
  if (feita) {
    return (
      <span
        role="img"
        aria-label="Tarefa feita"
        className="mt-px inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ok-fundo text-ok"
      >
        <Check aria-hidden strokeWidth={2.5} className="size-4" />
      </span>
    );
  }
  const r = 11;
  const c = 2 * Math.PI * r;
  const pct = total ? feitos / total : 0;
  return (
    <svg
      viewBox="0 0 28 28"
      role="img"
      aria-label={total ? `${plural(feitos, "passo feito", "passos feitos")} de ${total}` : "Sem passos"}
      className="mt-px size-7 shrink-0 -rotate-90"
    >
      <circle cx={14} cy={14} r={r} fill="none" className="stroke-linha" strokeWidth={3} />
      {pct > 0 && (
        <circle
          cx={14}
          cy={14}
          r={r}
          fill="none"
          className="stroke-caramelo transition-[stroke-dasharray] duration-300"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
        />
      )}
    </svg>
  );
}
