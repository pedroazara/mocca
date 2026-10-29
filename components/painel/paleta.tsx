"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  CalendarRange,
  Columns3,
  CornerDownLeft,
  Flag,
  Keyboard,
  ListTodo,
  MessagesSquare,
  Plus,
  Search,
  SunMoon,
  Tag,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { buscarNoPainel, criarReuniao } from "@/app/painel/acoes";
import { dataCurta } from "@/lib/painel/datas";
import { rotuloStatus, type Status } from "@/lib/painel/tipos";
import { normalizar } from "@/lib/painel/trello";
import { aplicarTema } from "@/lib/tema";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { Avatar } from "./elementos";

// Paleta de comandos (seção 8.2) e atalhos de teclado (seção 8.3).
// Ctrl/Cmd + K ou / abre; G S, G M e G Q navegam; ? mostra os atalhos.
// O botão "Nova tarefa" mora na barra superior: a paleta pede por evento.

export const EVENTO_PALETA = "mocca:paleta";
export const EVENTO_NOVA_TAREFA = "mocca:nova-tarefa";

type Opcao = {
  id: string;
  rotulo: string;
  detalhe?: string;
  Icone?: LucideIcon;
  avatar?: React.ReactNode;
  executar: () => void;
};
type Grupo = { titulo: string; opcoes: Opcao[] };
type Resultados = Awaited<ReturnType<typeof buscarNoPainel>>;

function emCampo(e: KeyboardEvent) {
  const alvo = e.target as HTMLElement | null;
  return Boolean(alvo?.closest("input, textarea, select, [contenteditable=true], [role=dialog]"));
}

export function PaletaComandos() {
  const { semanas, semanaAtual, ativas, etiquetas, podeEditar, avisar } = usePainel();
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [atalhos, setAtalhos] = useState(false);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Resultados & { termo: string }>({ tarefas: [], reunioes: [], termo: "" });
  const [ativo, setAtivo] = useState(0);
  const lista = useRef<HTMLDivElement>(null);

  // atalhos globais
  useEffect(() => {
    let g = 0;
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta((a) => !a);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || emCampo(e)) return;
      if (e.key === "/") {
        e.preventDefault();
        setAberta(true);
      } else if (e.key === "?") {
        e.preventDefault();
        setAtalhos(true);
      } else if (e.key === "g") {
        g = Date.now();
      } else if (Date.now() - g < 1000) {
        const destino = { s: "/painel", m: "/painel/minhas-tarefas", q: "/painel/quadro" }[e.key];
        g = 0;
        if (destino) {
          e.preventDefault();
          router.push(destino);
        }
      }
    };
    const abrir = () => setAberta(true);
    window.addEventListener("keydown", tecla);
    window.addEventListener(EVENTO_PALETA, abrir);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener(EVENTO_PALETA, abrir);
    };
  }, [router]);

  // busca no servidor (tarefas e reuniões), com uma pequena espera
  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) return;
    let valido = true;
    const espera = window.setTimeout(async () => {
      const r = await buscarNoPainel(t);
      if (valido) setResultados({ ...r, termo: t });
    }, 180);
    return () => {
      valido = false;
      window.clearTimeout(espera);
    };
  }, [termo]);

  const mudarAberta = (a: boolean) => {
    setAberta(a);
    if (!a) {
      setTermo("");
      setAtivo(0);
    }
  };

  const grupos = useMemo<Grupo[]>(() => {
    const ir = (href: string) => () => router.push(href);
    const t = normalizar(termo);
    const casa = (...textos: (string | null | undefined)[]) => !t || textos.some((x) => x && normalizar(x).includes(t));

    const acoes: Opcao[] = [
      ...(podeEditar
        ? [{ id: "nova-tarefa", rotulo: "Nova tarefa", detalhe: "N", Icone: Plus, executar: () => window.dispatchEvent(new Event(EVENTO_NOVA_TAREFA)) }]
        : []),
      { id: "semana", rotulo: "Ir para a semana atual", detalhe: "G S", Icone: CalendarRange, executar: ir("/painel") },
      { id: "minhas", rotulo: "Minhas tarefas", detalhe: "G M", Icone: UserCheck, executar: ir("/painel/minhas-tarefas") },
      { id: "quadro", rotulo: "Quadro", detalhe: "G Q", Icone: Columns3, executar: ir("/painel/quadro") },
      ...(podeEditar
        ? [
            {
              id: "nova-reuniao",
              rotulo: "Nova reunião",
              Icone: MessagesSquare,
              executar: async () => {
                const r = await criarReuniao();
                if (!r.ok) avisar(r.erro, { erro: true });
                else if (r.dado) router.push(`/painel/reunioes/${r.dado}`);
              },
            },
          ]
        : []),
      {
        id: "tema",
        rotulo: "Alternar tema",
        Icone: SunMoon,
        executar: () => {
          const raiz = document.documentElement;
          const escuro = raiz.dataset.tema ? raiz.dataset.tema === "escuro" : matchMedia("(prefers-color-scheme: dark)").matches;
          aplicarTema(escuro ? "claro" : "escuro");
        },
      },
      { id: "atalhos", rotulo: "Atalhos de teclado", detalhe: "?", Icone: Keyboard, executar: () => setAtalhos(true) },
    ].filter((o) => casa(o.rotulo));

    const lista: Grupo[] = [{ titulo: "Ações", opcoes: acoes }];
    if (!t) return lista;

    const atual = resultados.termo === termo.trim() ? resultados : { tarefas: [], reunioes: [] };
    lista.push({
      titulo: "Tarefas",
      opcoes: atual.tarefas.map((x) => ({
        id: `t-${x.id}`,
        rotulo: x.titulo,
        detalhe: [x.semana ? `semana ${x.semana}` : null, rotuloStatus(x.status as Status)].filter(Boolean).join(" · "),
        Icone: ListTodo,
        executar: ir(`/painel/tarefas/${x.id}`),
      })),
    });
    lista.push({
      titulo: "Pessoas",
      opcoes: ativas
        .filter((p) => casa(p.nome, p.apelido, p.frente))
        .map((p) => ({
          id: `p-${p.id}`,
          rotulo: p.nome,
          detalhe: p.frente ?? undefined,
          avatar: <Avatar pessoa={p} tamanho={20} titulo={false} />,
          executar: ir(`/painel/equipe/${p.id}`),
        })),
    });
    lista.push({
      titulo: "Semanas",
      opcoes: semanas
        .filter((s) => casa(`semana ${s.numero}`, s.entrega_titulo))
        .map((s) => ({
          id: `s-${s.numero}`,
          rotulo: `Semana ${s.numero}`,
          detalhe: [s.entrega_titulo, s.numero === semanaAtual ? "atual" : null].filter(Boolean).join(" · "),
          Icone: Flag,
          executar: ir(`/painel/semanas/${s.numero}`),
        })),
    });
    lista.push({
      titulo: "Etiquetas",
      opcoes: etiquetas
        .filter((e) => casa(e.nome))
        .map((e) => ({
          id: `e-${e.id}`,
          rotulo: e.nome,
          detalhe: "no quadro, todas as semanas",
          Icone: Tag,
          executar: ir(`/painel/quadro?semana=todas&etiqueta=${e.id}`),
        })),
    });
    lista.push({
      titulo: "Reuniões",
      opcoes: atual.reunioes.map((r) => ({
        id: `r-${r.id}`,
        rotulo: `Reunião de ${dataCurta(r.data)}`,
        Icone: MessagesSquare,
        executar: ir(`/painel/reunioes/${r.id}`),
      })),
    });
    return lista.filter((g) => g.opcoes.length);
  }, [termo, resultados, podeEditar, semanas, semanaAtual, ativas, etiquetas, router, avisar]);

  const opcoes = grupos.flatMap((g) => g.opcoes);
  const indice = Math.min(ativo, Math.max(opcoes.length - 1, 0));
  const escolhida = opcoes[indice];

  useEffect(() => {
    lista.current?.querySelector(`[data-indice="${indice}"]`)?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  const executar = (o: Opcao | undefined) => {
    if (!o) return;
    mudarAberta(false);
    o.executar();
  };

  const teclaNoCampo = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!opcoes.length) return;
      const passo = e.key === "ArrowDown" ? 1 : -1;
      setAtivo((indice + passo + opcoes.length) % opcoes.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      executar(escolhida);
    }
  };

  let n = -1;
  const buscando = termo.trim().length >= 2 && resultados.termo !== termo.trim();

  return (
    <>
      <Dialog.Root open={aberta} onOpenChange={mudarAberta}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-texto/30" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed top-[10dvh] left-1/2 z-50 flex max-h-[75dvh] w-[min(600px,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-g border border-linha bg-superficie shadow-flutuante"
          >
            <Dialog.Title className="sr-only">Paleta de comandos</Dialog.Title>
            <div className="flex items-center gap-3 border-b border-linha px-4">
              <Search aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0 text-texto-2" />
              <input
                autoFocus
                value={termo}
                onChange={(e) => {
                  setTermo(e.target.value);
                  setAtivo(0);
                }}
                onKeyDown={teclaNoCampo}
                placeholder="Buscar tarefas, pessoas, semanas e reuniões…"
                role="combobox"
                aria-label="Buscar no painel"
                aria-expanded="true"
                aria-controls="paleta-lista"
                aria-autocomplete="list"
                aria-activedescendant={escolhida ? `paleta-${escolhida.id}` : undefined}
                className="h-14 min-w-0 flex-1 bg-transparent text-base text-texto outline-none placeholder:text-texto-2/70"
              />
              <Dialog.Close aria-label="Fechar" className="-mr-2 rounded-p p-2 text-texto-2 hover:bg-superficie-2">
                <X aria-hidden strokeWidth={1.75} className="size-[18px]" />
              </Dialog.Close>
            </div>
            <div ref={lista} id="paleta-lista" role="listbox" aria-label="Resultados" className="overflow-y-auto p-2">
              {grupos.map((g) => (
                <div key={g.titulo} role="group" aria-labelledby={`paleta-grupo-${g.titulo}`} className="pb-1">
                  <p id={`paleta-grupo-${g.titulo}`} className="t-rotulo px-2 pt-2 pb-1 text-[0.6875rem] text-texto-2">
                    {g.titulo}
                  </p>
                  {g.opcoes.map((o) => {
                    n += 1;
                    const i = n;
                    return (
                      <div
                        key={o.id}
                        id={`paleta-${o.id}`}
                        role="option"
                        aria-selected={i === indice}
                        data-indice={i}
                        onMouseMove={() => i !== indice && setAtivo(i)}
                        onClick={() => executar(o)}
                        className={cn(
                          "flex h-10 cursor-pointer items-center gap-3 rounded-p px-2 text-[0.9375rem] text-texto",
                          i === indice && "bg-superficie-2",
                        )}
                      >
                        {o.avatar ?? (o.Icone && <o.Icone aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-texto-2" />)}
                        <span className="min-w-0 flex-1 truncate">{o.rotulo}</span>
                        {o.detalhe && <span className="t-pequeno hidden max-w-[45%] truncate text-texto-2 sm:block">{o.detalhe}</span>}
                        {i === indice && <CornerDownLeft aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-texto-2" />}
                      </div>
                    );
                  })}
                </div>
              ))}
              {!opcoes.length && !buscando && (
                <p className="px-2 py-6 text-center text-[0.9375rem] text-texto-2">Nada encontrado para “{termo.trim()}”.</p>
              )}
              {buscando && <p className="t-pequeno px-2 py-2 text-texto-2">Buscando tarefas…</p>}
            </div>
            <p role="status" className="sr-only">
              {buscando ? "" : `${opcoes.length} ${opcoes.length === 1 ? "resultado" : "resultados"}`}
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={atalhos} onOpenChange={setAtalhos}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-texto/30" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-g border border-linha bg-superficie p-6 shadow-flutuante"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <Dialog.Title className="font-titulo text-[1.25rem] font-semibold text-texto">Atalhos de teclado</Dialog.Title>
              <Dialog.Close aria-label="Fechar" className="-mt-1 -mr-2 rounded-p p-2 text-texto-2 hover:bg-superficie-2">
                <X aria-hidden strokeWidth={1.75} className="size-[18px]" />
              </Dialog.Close>
            </div>
            <dl className="flex flex-col divide-y divide-linha">
              {(
                [
                  [["Ctrl", "K"], "Paleta de comandos"],
                  [["/"], "Buscar"],
                  [["N"], "Nova tarefa"],
                  [["G", "S"], "Ir para a Semana"],
                  [["G", "M"], "Ir para Minhas tarefas"],
                  [["G", "Q"], "Ir para o Quadro"],
                  [["Esc"], "Fechar o painel lateral ou a janela"],
                  [["Ctrl", "Enter"], "Enviar o comentário"],
                  [["Espaço"], "No quadro: pegar e soltar o cartão (setas movem)"],
                  [["?"], "Esta lista"],
                ] as const
              ).map(([teclas, acao]) => (
                <div key={acao} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-[0.9375rem] text-texto">{acao}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {teclas.map((t) => (
                      <kbd key={t} className="t-dado min-w-7 rounded-p border border-linha bg-superficie-2 px-1.5 py-0.5 text-center text-[0.75rem] text-texto">
                        {t}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="t-pequeno mt-4 text-texto-2">No Mac, use Cmd no lugar de Ctrl.</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
