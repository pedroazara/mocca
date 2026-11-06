"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Popover from "@radix-ui/react-popover";
import {
  AlertTriangle,
  Archive,
  Check,
  ArchiveRestore,
  Copy,
  FileSpreadsheet,
  FileText,
  Folder,
  GripVertical,
  Link2,
  Mail,
  Paperclip,
  Plus,
  Presentation,
  Send,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import * as acoes from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { estiloControle } from "@/components/ui/campo";
import { enderecoDeExemplo } from "@/lib/email/exemplo";
import { dataHora, deCampoData, paraCampoData, textoPrazo } from "@/lib/painel/datas";
import {
  ORIGENS,
  rotuloStatus,
  STATUS,
  TIPOS_DOCUMENTO,
  type Atribuicao,
  type Historico,
  type Item,
  type Pessoa,
  type Status,
  type TarefaCompleta,
  type TipoDocumento,
} from "@/lib/painel/tipos";
import { cn, listaNomes } from "@/lib/utils";
import { AreaDeArquivos, CampoArquivos, LinhaPdf, Miniaturas, TextoEnviando, useAnexar } from "./anexos";
import { usePainel } from "./contexto";
import { textoEnvio } from "./elementos";
import { Avatar, ChipEtiqueta, corPrazo } from "./elementos";
import { Markdown } from "./markdown";

// Detalhe da tarefa (seção 9.4): título e status em cima e duas colunas, o trabalho
// à esquerda (descrição, pessoas com seus itens, o "um checklist por pessoa" do Trello,
// documentos, comentários e histórico) e os detalhes à direita. Cada dado aparece
// num lugar só. As ações ficam em AcoesTarefa, na barra da janela ou no topo da
// página. Usado na janela e na página da tarefa; as colunas dependem da largura
// disponível, não da tela.

type Rodar = <T>(acao: () => Promise<{ ok: true; dado?: T } | { ok: false; erro: string }>, sucesso?: string) => Promise<T | undefined>;

function useRodar(): [boolean, Rodar] {
  const { avisar } = usePainel();
  const [pendente, iniciar] = useTransition();
  const rodar: Rodar = (acao, sucesso) =>
    new Promise((resolver) => {
      iniciar(async () => {
        const r = await acao();
        if (!r.ok) avisar(r.erro, { erro: true });
        else if (sucesso) avisar(sucesso);
        resolver(r.ok ? r.dado : undefined);
      });
    });
  return [pendente, rodar];
}

const rotulo = "t-rotulo text-texto-2";

// comentários feitos pela API aparecem como "Claude"
const CLAUDE = { id: "claude", nome: "Claude", apelido: "Claude", cor: "#B9733F" };

// acima disso, a descrição (um roteiro colado, por exemplo) abre recolhida
const LIMITE_DESCRICAO = 600;

// Atalhos da tarefa aberta (seção 8.3): E edita o título, A atribui pessoa e
// D vai para o prazo. Cada tarefa na tela tem o seu canal (a página inteira
// pode estar embaixo da janela de outra tarefa), e cada parte dela escuta o seu.
const EVENTO_ATALHO_TAREFA = "mocca:atalho-tarefa";
type AtalhoTarefa = "titulo" | "atribuir" | "prazo";
const CanalAtalhos = createContext<EventTarget | null>(null);

function useAtalhoTarefa(qual: AtalhoTarefa, fazer: () => void) {
  const canal = useContext(CanalAtalhos);
  const ref = useRef(fazer);
  ref.current = fazer;
  useEffect(() => {
    if (!canal) return;
    const ouvir = (e: Event) => {
      if ((e as CustomEvent<AtalhoTarefa>).detail === qual) ref.current();
    };
    canal.addEventListener(EVENTO_ATALHO_TAREFA, ouvir);
    return () => canal.removeEventListener(EVENTO_ATALHO_TAREFA, ouvir);
  }, [canal, qual]);
}

function AtalhosTarefa({ canal, raiz }: { canal: EventTarget; raiz: React.RefObject<HTMLDivElement | null> }) {
  const { podeEditar } = usePainel();
  useEffect(() => {
    if (!podeEditar) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const alvo = e.target as HTMLElement | null;
      // digitando num campo, ou com outra janela por cima (menu, seletor), não vale
      if (alvo?.closest("input, textarea, select, [contenteditable=true], [role=menu], [role=listbox]")) return;
      if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
      // só a tarefa de cima: a janela aberta por último precisa conter esta
      const janelas = document.querySelectorAll("[role=dialog][data-state=open], [role=alertdialog][data-state=open]");
      const topo = janelas[janelas.length - 1];
      if (!raiz.current || (topo && !topo.contains(raiz.current))) return;
      const qual = ({ e: "titulo", a: "atribuir", d: "prazo" } as const)[e.key.toLowerCase() as "e" | "a" | "d"];
      if (!qual) return;
      e.preventDefault();
      canal.dispatchEvent(new CustomEvent(EVENTO_ATALHO_TAREFA, { detail: qual }));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [podeEditar, canal, raiz]);
  return null;
}

export function DetalheTarefa({ tarefa: t }: { tarefa: TarefaCompleta }) {
  const [canal] = useState(() => new EventTarget());
  const raiz = useRef<HTMLDivElement>(null);
  return (
    <CanalAtalhos.Provider value={canal}>
      <div ref={raiz} className="@container flex flex-col gap-6">
        <AtalhosTarefa canal={canal} raiz={raiz} />
        <Cabecalho t={t} />
        {t.arquivada && (
          <p className="rounded-m bg-superficie-2 px-3 py-2 text-[0.875rem] text-texto-2">
            Esta tarefa está arquivada e não aparece no Quadro nem nas listas.
          </p>
        )}
        <div className="grid grid-cols-1 gap-x-8 gap-y-7 @3xl:grid-cols-[minmax(0,1fr)_280px]">
          <Propriedades t={t} />
          <div className="flex min-w-0 flex-col gap-7 @3xl:col-start-1 @3xl:row-start-1">
            <Descricao t={t} />
            <Pessoas t={t} />
            <Documentos t={t} />
            <ComentariosEHistorico t={t} />
          </div>
        </div>
      </div>
    </CanalAtalhos.Provider>
  );
}

// Toda seção do trabalho tem a mesma forma: rótulo à esquerda, ação à direita.
function Secao({
  id,
  titulo,
  acao,
  children,
}: {
  id: string;
  titulo: string;
  acao?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id={id} className={rotulo}>
          {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

function AcaoSecao(props: React.ComponentProps<typeof Botao>) {
  return <Botao variante="fantasma" tamanho="painel" className="-mr-2 h-8 px-2 text-[0.875rem] [&_svg]:size-4" {...props} />;
}

// ------------------------------------------------------------------ ações

const estiloAcao =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-p px-2 text-[0.875rem] transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-60";

// Sempre à vista, com nome, na barra da janela e no topo da página da tarefa.
// Arquivar tira a tarefa das listas: a janela fecha e o aviso oferece Desfazer.
export function AcoesTarefa({ tarefa: t, naPagina = false }: { tarefa: TarefaCompleta; naPagina?: boolean }) {
  const { podeEditar, avisar } = usePainel();
  const router = useRouter();
  const [pendente, rodar] = useRodar();

  const arquivar = async () => {
    if (!(await rodar(() => acoes.atualizarTarefa(t.id, { arquivada: true })))) return;
    avisar("Tarefa arquivada.", {
      desfazer: () => {
        acoes.atualizarTarefa(t.id, { arquivada: false }).then((r) => !r.ok && avisar(r.erro, { erro: true }));
      },
    });
    if (naPagina) router.push("/painel/quadro");
    else router.back();
  };

  const IconeArquivar = t.arquivada ? ArchiveRestore : Archive;
  const discreta = cn(estiloAcao, "text-texto-2 hover:bg-superficie-2 hover:text-texto");

  return (
    <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="Ações da tarefa">
      <button
        type="button"
        aria-label="Copiar link"
        title="Copiar link"
        className={discreta}
        onClick={() => {
          navigator.clipboard?.writeText(`${window.location.origin}/painel/tarefas/${t.id}`);
          avisar("Link copiado.");
        }}
      >
        <Link2 aria-hidden strokeWidth={1.75} className="size-4" />
        <span className="hidden sm:inline">Copiar link</span>
      </button>
      {podeEditar && (
        <button
          type="button"
          aria-label="Duplicar"
          title="Duplicar"
          disabled={pendente}
          className={discreta}
          onClick={async () => {
            const id = await rodar(() => acoes.duplicarTarefa(t.id), "Tarefa duplicada.");
            if (id) router.push(`/painel/tarefas/${id}`, { scroll: false });
          }}
        >
          <Copy aria-hidden strokeWidth={1.75} className="size-4" />
          <span className="hidden sm:inline">Duplicar</span>
        </button>
      )}
      {podeEditar && (
        <button
          type="button"
          disabled={pendente}
          className={cn(estiloAcao, "ml-1 border border-linha font-semibold text-texto hover:bg-superficie-2")}
          onClick={() => (t.arquivada ? rodar(() => acoes.atualizarTarefa(t.id, { arquivada: false }), "Tarefa restaurada.") : arquivar())}
        >
          <IconeArquivar aria-hidden strokeWidth={1.75} className="size-4" />
          {t.arquivada ? "Restaurar" : "Arquivar"}
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ cabeçalho

// Os quatro status à vista, na ordem das colunas do Quadro: um clique move a tarefa.
function SeletorStatus({ t }: { t: TarefaCompleta }) {
  const { podeEditar } = usePainel();
  const [status, setStatus] = useOptimistic(t.status);
  const [, iniciar] = useTransition();
  const [, rodar] = useRodar();

  return (
    <div role="group" aria-label="Status" className="flex w-full gap-1 rounded-m bg-superficie-2 p-1 sm:w-fit">
      {STATUS.map((s) => (
        <button
          key={s.valor}
          type="button"
          aria-pressed={status === s.valor}
          disabled={!podeEditar}
          onClick={() => {
            if (status === s.valor) return;
            iniciar(async () => {
              setStatus(s.valor);
              await rodar(() => acoes.atualizarTarefa(t.id, { status: s.valor }), `Movida para ${s.rotulo}.`);
            });
          }}
          className={cn(
            "flex-1 rounded-p px-2 py-1.5 text-[0.8125rem] whitespace-nowrap sm:flex-none sm:px-3 sm:text-[0.875rem]",
            status === s.valor ? "bg-superficie font-semibold text-texto shadow-cartao" : "text-texto-2 enabled:hover:text-texto",
          )}
        >
          {s.rotulo}
        </button>
      ))}
    </div>
  );
}

function Cabecalho({ t }: { t: TarefaCompleta }) {
  const { podeEditar } = usePainel();
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(t.titulo);
  const [, rodar] = useRodar();
  useEffect(() => setTitulo(t.titulo), [t.titulo]);
  useAtalhoTarefa("titulo", () => podeEditar && setEditando(true));

  const salvar = async () => {
    setEditando(false);
    if (titulo.trim() && titulo !== t.titulo) await rodar(() => acoes.atualizarTarefa(t.id, { titulo }));
    else setTitulo(t.titulo);
  };

  return (
    <header className="flex flex-col gap-3">
      {editando ? (
        <input
          autoFocus
          value={titulo}
          maxLength={200}
          onChange={(e) => setTitulo(e.target.value)}
          data-esc-local
          onBlur={salvar}
          onKeyDown={(e) => {
            if (e.key === "Enter") salvar();
            if (e.key === "Escape") {
              e.stopPropagation();
              setTitulo(t.titulo);
              setEditando(false);
            }
          }}
          aria-label="Título da tarefa"
          className={cn(estiloControle, "h-auto py-1.5 font-titulo text-[1.375rem] font-semibold")}
        />
      ) : (
        <h1
          className={cn(
            "font-titulo text-[1.375rem] leading-snug font-semibold text-texto",
            podeEditar && "-mx-1.5 cursor-text rounded-p px-1.5 hover:bg-superficie-2",
          )}
          onClick={() => podeEditar && setEditando(true)}
          title={podeEditar ? "Clique para editar" : undefined}
        >
          {titulo}
        </h1>
      )}
      <SeletorStatus t={t} />
    </header>
  );
}

// ------------------------------------------------------------------ propriedades

function Propriedades({ t }: { t: TarefaCompleta }) {
  const { podeEditar, semanas, etiquetas, etiqueta, pessoa } = usePainel();
  const [, rodar] = useRodar();
  const [etqs, setEtqs] = useOptimistic(t.etiquetas);
  const [, iniciar] = useTransition();
  const linha = "grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3 min-h-9";
  const criador = pessoa(t.criado_por);
  const campoPrazo = useRef<HTMLInputElement>(null);
  useAtalhoTarefa("prazo", () => {
    const c = campoPrazo.current;
    if (!c || c.disabled) return;
    c.focus();
    try {
      c.showPicker();
    } catch {
      // navegador sem showPicker: o campo fica focado, e as setas mudam a data
    }
  });

  return (
    <section
      aria-label="Detalhes"
      className="flex flex-col gap-1.5 rounded-m border border-linha bg-superficie p-4 @3xl:sticky @3xl:top-[var(--topo-tarefa,0px)] @3xl:col-start-2 @3xl:row-start-1 @3xl:self-start"
    >
      <div className={cn(linha, "items-start")}>
        <span className="pt-2 text-[0.875rem] text-texto-2">Prazo</span>
        <div className="min-w-0">
          <input
            ref={campoPrazo}
            type="date"
            value={paraCampoData(t.prazo)}
            disabled={!podeEditar}
            onChange={(e) => rodar(() => acoes.atualizarTarefa(t.id, { prazo: deCampoData(e.target.value) }))}
            className={cn(estiloControle, "h-9 w-full")}
            aria-label="Prazo"
          />
          {t.prazo && t.status !== "feito" && (
            <p className={cn("t-dado mt-1 text-[0.8125rem]", corPrazo(t.prazo, t.status))}>{textoPrazo(t.prazo)}</p>
          )}
        </div>
      </div>
      <div className={linha}>
        <span className="text-[0.875rem] text-texto-2">Semana</span>
        <select
          aria-label="Semana"
          value={t.semana ?? ""}
          disabled={!podeEditar}
          // trocar de semana leva o prazo junto, como na tela Semana (DUVIDAS 4m)
          onChange={(e) =>
            rodar(() =>
              e.target.value ? acoes.moverParaSemana(t.id, Number(e.target.value)) : acoes.atualizarTarefa(t.id, { semana: null }),
            )
          }
          className={cn(estiloControle, "h-9 w-full")}
        >
          <option value="">Sem semana</option>
          {semanas.map((s) => (
            <option key={s.numero} value={s.numero}>
              Semana {s.numero}
            </option>
          ))}
        </select>
      </div>
      <div className={cn(linha, "items-start")}>
        <span className="pt-2 text-[0.875rem] text-texto-2">Etiquetas</span>
        <div className="flex flex-wrap items-center gap-1.5 py-1.5">
          {etqs.map((e) => (
            <ChipEtiqueta key={e} etiqueta={etiqueta(e)} />
          ))}
          {podeEditar && (
            <Popover.Root>
              <Popover.Trigger className="inline-flex h-[22px] items-center gap-1 rounded-full border border-dashed border-linha px-2 text-[0.75rem] text-texto-2 hover:border-texto-2 hover:text-texto">
                <Plus aria-hidden strokeWidth={2} className="size-3" />
                {etqs.length ? "Editar" : "Adicionar"}
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content align="start" sideOffset={6} className="z-50 w-60 rounded-m border border-linha bg-superficie p-2 shadow-flutuante">
                  {etiquetas.map((e) => {
                    const marcada = etqs.includes(e.id);
                    return (
                      <label key={e.id} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-p px-2 hover:bg-superficie-2">
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() => {
                            const nova = marcada ? etqs.filter((x) => x !== e.id) : [...etqs, e.id];
                            iniciar(async () => {
                              setEtqs(nova);
                              await rodar(() => acoes.definirEtiquetas(t.id, nova));
                            });
                          }}
                         
                        />
                        <ChipEtiqueta etiqueta={e} />
                      </label>
                    );
                  })}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}
        </div>
      </div>
      <label className="flex items-start gap-2 py-1.5 text-[0.875rem] leading-snug text-texto">
        <input
          type="checkbox"
          checked={t.ligada_entrega}
          disabled={!podeEditar}
          onChange={(e) => rodar(() => acoes.atualizarTarefa(t.id, { ligada_entrega: e.target.checked }))}
          className="mt-px shrink-0"
        />
        Ligada à entrega do programa
      </label>
      <EmailDaTarefa t={t} />
      <p className="mt-1.5 border-t border-linha pt-3 text-[0.8125rem] leading-snug text-texto-2">
        {ORIGENS[t.origem]}
        {criador && ` · criada por ${criador.apelido ?? criador.nome}`}
        {` · ${dataHora(t.criado_em)}`}
      </p>
    </section>
  );
}

// Para quem o e-mail desta tarefa já foi e o botão para quem falta. A tarefa
// ligada à entrega de uma semana não tem e-mail próprio: vai no pacote dela, e o
// botão manda o pacote para todos da semana que ainda não receberam.
function EmailDaTarefa({ t }: { t: TarefaCompleta }) {
  const { pessoa, podeEditar, avisar } = usePainel();
  const [enviando, rodar] = useRodar();
  const doPacote = t.ligada_entrega && Boolean(t.semana_id);
  const envios = t.emails.filter((e) => e.tipo === (doPacote ? "entrega" : "tarefa"));
  const recebeu = new Set(envios.map((e) => e.pessoa_id));
  const pessoas = t.atribuicoes.map((a) => pessoa(a.pessoa_id)).filter((p): p is Pessoa => Boolean(p?.ativo));
  const enviados = pessoas.filter((p) => recebeu.has(p.id));
  const faltam = pessoas.filter((p) => !recebeu.has(p.id) && !enderecoDeExemplo(p.email));
  const semEmail = pessoas.filter((p) => !recebeu.has(p.id) && enderecoDeExemplo(p.email));
  const ultimo = envios.map((e) => e.enviado_em).sort().at(-1);
  const nomes = (ps: Pessoa[]) => listaNomes(ps.map((p) => p.apelido ?? p.nome));
  const podeEnviar = podeEditar && faltam.length > 0 && t.status !== "feito" && !t.arquivada;

  const enviar = async () => {
    const r = await rodar(() => (doPacote ? acoes.enviarPacoteDaSemana(t.semana_id!) : acoes.enviarEmailDaTarefa(t.id)));
    if (r) avisar(textoEnvio(doPacote ? "Pacote enviado" : "E-mail enviado", r));
  };

  return (
    <div className="mt-1.5 flex flex-col gap-1.5 border-t border-linha pt-3 text-[0.875rem]">
      <p className="flex items-center gap-1.5 text-texto-2">
        <Mail aria-hidden strokeWidth={1.75} className="size-4" />
        {doPacote ? `E-mail: vai no pacote da entrega da semana ${t.semana}` : "E-mail"}
      </p>
      {pessoas.length === 0 ? (
        <p className="text-texto-2">Ninguém atribuído para receber.</p>
      ) : (
        <>
          {enviados.length > 0 ? (
            <p className="text-texto">
              <Check aria-hidden strokeWidth={2} className="mr-1 inline size-3.5 align-[-2px] text-ok" />
              {doPacote ? "Foi no pacote para" : "Enviado para"} {nomes(enviados)}
              {ultimo && <span className="t-dado block text-[0.8125rem] text-texto-2">{dataHora(ultimo)}</span>}
            </p>
          ) : (
            <p className="text-texto-2">{doPacote ? "Ainda não foi em nenhum pacote." : "Ainda não enviado."}</p>
          )}
          {semEmail.length > 0 && <p className="text-[0.8125rem] text-texto-2">Sem e-mail cadastrado: {nomes(semEmail)}.</p>}
          {podeEnviar && (
            <Botao variante="secundario" tamanho="painel" className="mt-1 h-auto min-h-9 justify-start py-1.5 text-left" disabled={enviando} onClick={enviar}>
              <Send aria-hidden />
              {enviando ? "Enviando…" : doPacote ? "Enviar o pacote da semana" : `Enviar para ${nomes(faltam)}`}
            </Botao>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ descrição

function Descricao({ t }: { t: TarefaCompleta }) {
  const { podeEditar } = usePainel();
  const [editando, setEditando] = useState(false);
  const [aba, setAba] = useState<"escrever" | "ver">("escrever");
  const [texto, setTexto] = useState(t.descricao ?? "");
  const [inteira, setInteira] = useState(false);
  const [pendente, rodar] = useRodar();
  useEffect(() => setTexto(t.descricao ?? ""), [t.descricao]);
  const longa = (t.descricao?.length ?? 0) > LIMITE_DESCRICAO;

  if (!podeEditar && !t.descricao) return null;

  return (
    <Secao
      id="descricao"
      titulo="Descrição"
      acao={
        podeEditar &&
        !editando && (
          <AcaoSecao onClick={() => setEditando(true)}>
            {!t.descricao && <Plus aria-hidden />}
            {t.descricao ? "Editar" : "Escrever"}
          </AcaoSecao>
        )
      }
    >
      {editando ? (
        <div className="rounded-m border border-linha bg-superficie">
          <div className="flex gap-1 border-b border-linha p-1" role="tablist">
            {(["escrever", "ver"] as const).map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={aba === a}
                onClick={() => setAba(a)}
                className={cn("rounded-p px-3 py-1 text-[0.875rem]", aba === a ? "bg-superficie-2 font-semibold text-texto" : "text-texto-2")}
              >
                {a === "escrever" ? "Escrever" : "Visualizar"}
              </button>
            ))}
          </div>
          {aba === "escrever" ? (
            <textarea
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={8}
              placeholder="Cole o roteiro ou descreva a tarefa. Aceita **negrito**, *itálico*, listas e links."
              className="block w-full resize-y bg-transparent p-3 text-[0.9375rem] leading-relaxed text-texto outline-none placeholder:text-texto-2/70"
            />
          ) : (
            <div className="min-h-32 p-3">{texto ? <Markdown texto={texto} /> : <p className="text-texto-2">Nada para mostrar.</p>}</div>
          )}
          <div className="flex justify-end gap-2 border-t border-linha p-2">
            <Botao
              variante="fantasma"
              tamanho="painel"
              onClick={() => {
                setTexto(t.descricao ?? "");
                setEditando(false);
              }}
            >
              Cancelar
            </Botao>
            <Botao
              tamanho="painel"
              disabled={pendente}
              onClick={async () => {
                await rodar(() => acoes.atualizarTarefa(t.id, { descricao: texto }));
                setEditando(false);
              }}
            >
              Salvar descrição
            </Botao>
          </div>
        </div>
      ) : (
        t.descricao && (
          <>
            <div className={cn(longa && !inteira && "max-h-44 overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]")}>
              <Markdown texto={t.descricao} />
            </div>
            {longa && (
              <button type="button" onClick={() => setInteira(!inteira)} className="link w-fit text-[0.875rem]">
                {inteira ? "Ver menos" : "Ver tudo"}
              </button>
            )}
          </>
        )
      )}
    </Secao>
  );
}

// ------------------------------------------------------------------ pessoas e itens

function Pessoas({ t }: { t: TarefaCompleta }) {
  const { podeEditar } = usePainel();
  const semResponsavel = t.status !== "feito" && !t.atribuicoes.some((a) => a.papel === "responsavel");
  return (
    <Secao id="pessoas" titulo="Pessoas" acao={podeEditar && <AtribuirPessoa t={t} />}>
      {semResponsavel && (
        <p className="flex items-center gap-2 rounded-m bg-alerta-fundo px-3 py-2 text-[0.875rem] text-alerta">
          <AlertTriangle aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
          Sem responsável. Toda tarefa aberta precisa de pelo menos um.
        </p>
      )}
      {t.atribuicoes.length === 0 && !semResponsavel && <p className="text-[0.875rem] text-texto-2">Ninguém atribuído.</p>}
      {t.atribuicoes.map((a) => (
        <BlocoPessoa key={a.id} a={a} />
      ))}
    </Secao>
  );
}

function AtribuirPessoa({ t }: { t: TarefaCompleta }) {
  const { ativas } = usePainel();
  const [aberto, setAberto] = useState(false);
  const [, rodar] = useRodar();
  const livres = ativas.filter((p) => !t.atribuicoes.some((a) => a.pessoa_id === p.id));
  const temResponsavel = t.atribuicoes.some((a) => a.papel === "responsavel");
  useAtalhoTarefa("atribuir", () => livres.length > 0 && setAberto(true));
  return (
    <Popover.Root open={aberto} onOpenChange={setAberto}>
      <Popover.Trigger asChild>
        <AcaoSecao disabled={!livres.length}>
          <UserPlus aria-hidden /> Atribuir pessoa
        </AcaoSecao>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-50 w-64 rounded-m border border-linha bg-superficie p-1.5 shadow-flutuante">
          {livres.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={async () => {
                setAberto(false);
                await rodar(() => acoes.atribuir(t.id, p.id, temResponsavel ? "apoio" : "responsavel"));
              }}
              className="flex h-10 w-full items-center gap-2.5 rounded-p px-2 text-left hover:bg-superficie-2"
            >
              <Avatar pessoa={p} tamanho={28} titulo={false} />
              <span className="flex-1 truncate text-texto">{p.nome}</span>
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function BlocoPessoa({ a }: { a: Atribuicao }) {
  const { pessoa, podeEditar } = usePainel();
  const p = pessoa(a.pessoa_id);
  const [confirmar, setConfirmar] = useState(false);
  const [novo, setNovo] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [ordem, setOrdem] = useState(a.itens);
  const [, rodar] = useRodar();
  useEffect(() => setOrdem(a.itens), [a.itens]);
  const idDnd = useId();
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const soltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const de = ordem.findIndex((i) => i.id === e.active.id);
    const para = ordem.findIndex((i) => i.id === e.over!.id);
    const nova = arrayMove(ordem, de, para);
    setOrdem(nova);
    rodar(() => acoes.reordenarItens(nova.map((i) => i.id)));
  };

  return (
    <div className="rounded-m border border-linha bg-superficie p-3">
      <div className="flex items-center gap-2.5">
        <Avatar pessoa={p} tamanho={28} />
        <span className="min-w-0 flex-1 truncate font-semibold text-texto">{p?.apelido ?? p?.nome ?? "Pessoa removida"}</span>
        <select
          aria-label={`Papel de ${p?.nome}`}
          value={a.papel}
          disabled={!podeEditar}
          onChange={(e) => rodar(() => acoes.mudarPapel(a.id, e.target.value as "responsavel" | "apoio"))}
          className={cn(estiloControle, "h-8 w-auto border-transparent bg-transparent px-1.5 py-0 text-[0.8125rem] text-texto-2 hover:border-linha")}
        >
          <option value="responsavel">responsável</option>
          <option value="apoio">apoio</option>
        </select>
        {podeEditar &&
          (confirmar ? (
            <span className="flex items-center gap-1">
              <Botao variante="fantasma" tamanho="painel" className="h-8 px-2 text-erro" onClick={() => rodar(() => acoes.removerAtribuicao(a.id), "Pessoa removida da tarefa.")}>
                Remover
              </Botao>
              <Botao variante="fantasma" tamanho="painel" className="h-8 px-2" onClick={() => setConfirmar(false)}>
                Manter
              </Botao>
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Remover ${p?.nome} da tarefa`}
              onClick={() => setConfirmar(true)}
              className="rounded-p p-1.5 text-texto-2 hover:bg-superficie-2 hover:text-erro"
            >
              <X aria-hidden strokeWidth={1.75} className="size-4" />
            </button>
          ))}
      </div>
      {confirmar && (
        <p className="mt-2 text-[0.8125rem] text-texto-2">Remover {p?.apelido ?? p?.nome} e os itens dele desta tarefa?</p>
      )}
      <DndContext id={idDnd} sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltar}>
        <SortableContext items={ordem.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="mt-2 flex flex-col">
            {ordem.map((i) => (
              <ItemEditavel key={i.id} item={i} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {podeEditar &&
        (adicionando ? (
          <form
            className="mt-1 flex gap-2 pl-6"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!novo.trim()) return;
              const texto = novo;
              setNovo("");
              await rodar(() => acoes.adicionarItem(a.id, texto));
            }}
          >
            <input
              autoFocus
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              data-esc-local
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setAdicionando(false);
                }
              }}
              placeholder="Novo item"
              maxLength={500}
              className={cn(estiloControle, "h-8 text-[0.875rem]")}
            />
            <Botao type="submit" tamanho="painel" className="h-8">
              Adicionar
            </Botao>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdicionando(true)}
            className="mt-1 ml-6 inline-flex items-center gap-1 rounded-p px-1 py-1 text-[0.8125rem] text-texto-2 hover:text-texto"
          >
            <Plus aria-hidden strokeWidth={2} className="size-3.5" /> Adicionar item
          </button>
        ))}
    </div>
  );
}

function ItemEditavel({ item }: { item: Item }) {
  const { podeEditar } = usePainel();
  const [feito, setFeito] = useOptimistic(item.feito);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(item.texto);
  const [, iniciar] = useTransition();
  const [, rodar] = useRodar();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !podeEditar });
  useEffect(() => setTexto(item.texto), [item.texto]);

  const salvar = () => {
    setEditando(false);
    if (texto.trim() && texto !== item.texto) rodar(() => acoes.editarItem(item.id, texto));
    else setTexto(item.texto);
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group flex items-start gap-1.5 rounded-p py-1", isDragging && "relative z-10 bg-superficie-2 shadow-flutuante")}
    >
      {podeEditar ? (
        <button
          type="button"
          aria-label={`Arrastar "${item.texto}"`}
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none rounded-p text-texto-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-40"
        >
          <GripVertical aria-hidden strokeWidth={1.75} className="size-4" />
        </button>
      ) : (
        <span className="w-4" />
      )}
      <input
        type="checkbox"
        checked={feito}
        disabled={!podeEditar}
        aria-label={item.texto}
        onChange={(e) => {
          const novo = e.target.checked;
          iniciar(async () => {
            setFeito(novo);
            await rodar(() => acoes.marcarItem(item.id, novo));
          });
        }}
        className="mt-px shrink-0"
      />
      {editando ? (
        <input
          autoFocus
          value={texto}
          maxLength={500}
          onChange={(e) => setTexto(e.target.value)}
          data-esc-local
          onBlur={salvar}
          onKeyDown={(e) => {
            if (e.key === "Enter") salvar();
            if (e.key === "Escape") {
              e.stopPropagation();
              setTexto(item.texto);
              setEditando(false);
            }
          }}
          className={cn(estiloControle, "h-7 flex-1 px-2 text-[0.875rem]")}
        />
      ) : (
        <span
          onClick={() => podeEditar && setEditando(true)}
          className={cn("flex-1 text-[0.9375rem] leading-snug", feito ? "text-texto-2 line-through" : "text-texto", podeEditar && "cursor-text")}
        >
          {item.texto}
        </span>
      )}
      {podeEditar && !editando && (
        <button
          type="button"
          aria-label={`Apagar "${item.texto}"`}
          onClick={() => rodar(() => acoes.removerItem(item.id))}
          className="rounded-p p-0.5 text-texto-2 opacity-0 group-hover:opacity-100 hover:text-erro focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Trash2 aria-hidden strokeWidth={1.75} className="size-3.5" />
        </button>
      )}
    </li>
  );
}

// ------------------------------------------------------------------ documentos

export function iconeDocumento(url: string) {
  if (url.includes("/spreadsheets/")) return FileSpreadsheet;
  if (url.includes("/presentation/")) return Presentation;
  if (url.includes("/folders/")) return Folder;
  return FileText;
}

export function tituloPelaUrl(url: string) {
  if (url.includes("/spreadsheets/")) return "Planilha";
  if (url.includes("/presentation/")) return "Apresentação";
  if (url.includes("/folders/")) return "Pasta";
  if (url.includes("/document/")) return "Documento";
  if (/\.pdf|\/file\//.test(url)) return "Arquivo";
  return "";
}

// Links do Drive e, desde a DUVIDAS 4p, fotos e PDFs anexados do computador
// (pelo botão ou arrastando para a seção). PDFs entram na lista com os links;
// as fotos, numa fileira de miniaturas embaixo.
function Documentos({ t }: { t: TarefaCompleta }) {
  const { podeEditar } = usePainel();
  const [aberto, setAberto] = useState(false);
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoDocumento>("outro");
  const [pendente, rodar] = useRodar();
  const valida = /^https:\/\/(drive|docs)\.google\.com\//.test(url);
  const { enviar, enviando } = useAnexar({ tarefa: t.id }, t.lista_anexos.length);
  const fotos = t.lista_anexos.filter((a) => a.tipo === "foto");
  const pdfs = t.lista_anexos.filter((a) => a.tipo === "pdf");
  const temLista = t.lista_documentos.length > 0 || pdfs.length > 0;

  return (
    <AreaDeArquivos ativa={podeEditar} enviar={(l) => void enviar(l)}>
      <Secao
        id="documentos"
        titulo="Documentos"
        acao={
          podeEditar && (
            <div className="-mr-2 flex flex-wrap items-center justify-end gap-x-1">
              <TextoEnviando enviando={enviando} />
              <CampoArquivos
                enviar={(l) => void enviar(l)}
                enviando={Boolean(enviando)}
                className="inline-flex h-8 items-center gap-1.5 rounded-m px-2 text-[0.875rem] font-semibold text-texto-2 transition-colors hover:bg-superficie-2 hover:text-texto"
              >
                <Paperclip aria-hidden strokeWidth={1.75} className="size-4" /> Anexar
                <span className="hidden @md:inline">foto ou PDF</span>
              </CampoArquivos>
              {!aberto && (
                <AcaoSecao onClick={() => setAberto(true)} className="mr-0 h-8 px-2 text-[0.875rem] [&_svg]:size-4">
                  <Plus aria-hidden /> Link do Drive
                </AcaoSecao>
              )}
            </div>
          )
        }
      >
        {temLista ? (
          <ul className="flex flex-col divide-y divide-linha rounded-m border border-linha bg-superficie">
            {t.lista_documentos.map((d) => {
              const Icone = iconeDocumento(d.url);
              return (
                <li key={d.id} className="group flex items-center gap-3 px-3 py-2.5">
                  <Icone aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0 text-caramelo" />
                  <a href={d.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-texto hover:underline">
                    {d.titulo}
                  </a>
                  <span className="t-rotulo shrink-0 text-[0.6875rem] text-texto-2">{TIPOS_DOCUMENTO.find((x) => x.valor === d.tipo)?.rotulo}</span>
                  {podeEditar && (
                    <button
                      type="button"
                      aria-label={`Remover ${d.titulo}`}
                      onClick={() => rodar(() => acoes.removerDocumento(d.id))}
                      className="rounded-p p-1 text-texto-2 opacity-0 group-hover:opacity-100 hover:text-erro focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <Trash2 aria-hidden strokeWidth={1.75} className="size-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
            {pdfs.map((p) => (
              <LinhaPdf key={p.id} pdf={p} naLista />
            ))}
          </ul>
        ) : (
          !podeEditar && !fotos.length && <p className="text-[0.875rem] text-texto-2">Nenhum documento ligado.</p>
        )}
        <Miniaturas fotos={fotos} contexto={t.titulo} />
        {aberto && (
          <form
            className="flex flex-col gap-2 rounded-m border border-linha bg-superficie p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              await rodar(() => acoes.adicionarDocumento({ tarefaId: t.id, titulo: titulo || tituloPelaUrl(url), url, tipo }), "Documento ligado.");
              setUrl("");
              setTitulo("");
              setTipo("outro");
              setAberto(false);
            }}
          >
            <input
              autoFocus
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (!titulo) setTitulo(tituloPelaUrl(e.target.value));
              }}
              placeholder="https://docs.google.com/document/d/…"
              aria-label="Link do Google Drive"
              aria-invalid={url && !valida ? true : undefined}
              className={cn(estiloControle, "h-9")}
            />
            {url && !valida && <p className="t-pequeno text-erro">Use um link do Google Drive ou do Google Docs.</p>}
            <div className="flex gap-2">
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título"
                aria-label="Título do documento"
                maxLength={200}
                className={cn(estiloControle, "h-9 flex-1")}
              />
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)} aria-label="Tipo" className={cn(estiloControle, "h-9 w-auto")}>
                {TIPOS_DOCUMENTO.map((x) => (
                  <option key={x.valor} value={x.valor}>
                    {x.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Botao type="button" variante="fantasma" tamanho="painel" onClick={() => setAberto(false)}>
                Cancelar
              </Botao>
              <Botao type="submit" tamanho="painel" disabled={!valida || pendente}>
                Ligar documento
              </Botao>
            </div>
          </form>
        )}
      </Secao>
    </AreaDeArquivos>
  );
}

// ------------------------------------------------------------------ comentários e histórico

function ComentariosEHistorico({ t }: { t: TarefaCompleta }) {
  const { pessoa, eu, ehAdmin } = usePainel();
  const [aba, setAba] = useState<"comentarios" | "historico">("comentarios");
  const [texto, setTexto] = useState("");
  const [pendente, rodar] = useRodar();
  const form = useRef<HTMLFormElement>(null);

  return (
    <section aria-label="Comentários e histórico" className="flex flex-col gap-3">
      <div className="flex gap-1 border-b border-linha" role="tablist">
        {(
          [
            ["comentarios", `Comentários (${t.lista_comentarios.length})`],
            ["historico", "Histórico"],
          ] as const
        ).map(([v, r]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={aba === v}
            onClick={() => setAba(v)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-[0.875rem]",
              aba === v ? "border-caramelo font-semibold text-texto" : "border-transparent text-texto-2 hover:text-texto",
            )}
          >
            {r}
          </button>
        ))}
      </div>

      {aba === "comentarios" ? (
        <>
          <ul className="flex flex-col gap-4">
            {t.lista_comentarios.map((c) => {
              const autor = c.via_api ? CLAUDE : pessoa(c.autor_id);
              return (
                <li key={c.id} className="group flex gap-3">
                  <Avatar pessoa={autor} tamanho={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.8125rem] text-texto-2">
                      <span className="font-semibold text-texto">{autor?.apelido ?? autor?.nome}</span> · {dataHora(c.criado_em)}
                      {((c.autor_id && c.autor_id === eu.id) || ehAdmin) && (
                        <button
                          type="button"
                          onClick={() => rodar(() => acoes.apagarComentario(c.id))}
                          className="ml-2 text-texto-2 opacity-0 group-hover:opacity-100 hover:text-erro focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                        >
                          apagar
                        </button>
                      )}
                    </p>
                    <Markdown texto={c.texto} className="mt-1" />
                  </div>
                </li>
              );
            })}
          </ul>
          <form
            ref={form}
            className="flex flex-col gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!texto.trim()) return;
              const enviado = texto;
              setTexto("");
              await rodar(() => acoes.comentar(t.id, enviado));
            }}
          >
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) form.current?.requestSubmit();
              }}
              rows={3}
              placeholder="Escreva um comentário. Use @nome para chamar alguém."
              aria-label="Novo comentário"
              className={cn(estiloControle, "resize-y py-2 text-[0.9375rem]")}
            />
            <div className="flex items-center justify-between">
              <span className="t-pequeno text-texto-2">Ctrl + Enter para enviar</span>
              <Botao type="submit" tamanho="painel" disabled={pendente || !texto.trim()}>
                Comentar
              </Botao>
            </div>
          </form>
        </>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {t.historico.map((h) => (
            <li key={h.id} className="flex gap-3 text-[0.875rem]">
              <span className="t-dado w-24 shrink-0 text-[0.75rem] text-texto-2">{dataHora(h.criado_em)}</span>
              <span className="text-texto">{descreverHistorico(h, (id) => pessoa(id)?.apelido ?? pessoa(id)?.nome ?? "alguém")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function descreverHistorico(h: Historico, nome: (id: string | null) => string) {
  const quem = h.via_api ? "Claude" : h.autor_id ? nome(h.autor_id) : "O site";
  const d = (h.detalhe ?? {}) as Record<string, string>;
  switch (h.acao) {
    case "criou":
      return `${quem} criou a tarefa (${ORIGENS[d.origem as keyof typeof ORIGENS] ?? "manual"}).`;
    case "status":
      return `${quem} mudou o status de ${rotuloStatus(d.de as Status)} para ${rotuloStatus(d.para as Status)}.`;
    case "prazo":
      return d.para ? `${quem} mudou o prazo para ${dataHora(d.para)}.` : `${quem} tirou o prazo.`;
    case "semana":
      if (!d.para) return `${quem} tirou a tarefa da semana ${d.de}.`;
      return d.de ? `${quem} passou a tarefa da semana ${d.de} para a ${d.para}.` : `${quem} pôs a tarefa na semana ${d.para}.`;
    case "atribuiu":
      return `${quem} atribuiu ${nome(d.pessoa_id)} como ${d.papel === "apoio" ? "apoio" : "responsável"}.`;
    case "desatribuiu":
      return `${quem} tirou ${nome(d.pessoa_id)} da tarefa.`;
    case "item_feito":
      return `${quem} marcou "${d.texto}" como feito.`;
    case "item_reaberto":
      return `${quem} reabriu "${d.texto}".`;
    default:
      return `${quem}: ${h.acao}.`;
  }
}

export function TarefaNaoEncontrada() {
  return <p className="text-texto-2">Esta tarefa não existe ou você não tem acesso a ela.</p>;
}

