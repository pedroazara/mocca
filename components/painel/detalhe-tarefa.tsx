"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Menu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Copy,
  FileSpreadsheet,
  FileText,
  Folder,
  GripVertical,
  Link2,
  MoreHorizontal,
  Plus,
  Presentation,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import * as acoes from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { estiloControle } from "@/components/ui/campo";
import { dataHora, deCampoData, paraCampoData } from "@/lib/painel/datas";
import {
  ORIGENS,
  rotuloStatus,
  STATUS,
  TIPOS_DOCUMENTO,
  type Atribuicao,
  type Historico,
  type Item,
  type Status,
  type TarefaCompleta,
  type TipoDocumento,
} from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { Avatar, ChipEtiqueta, Prazo } from "./elementos";
import { Markdown } from "./markdown";

// Detalhe da tarefa (seção 9.4): cabeçalho, propriedades, descrição, pessoas
// com seus itens (o "um checklist por pessoa" do Trello), documentos,
// comentários e histórico. Usado no painel lateral e na página da tarefa.

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

export function DetalheTarefa({ tarefa: t }: { tarefa: TarefaCompleta }) {
  const { podeEditar } = usePainel();
  const semResponsavel = t.status !== "feito" && !t.atribuicoes.some((a) => a.papel === "responsavel");
  return (
    <div className="flex flex-col gap-7">
      <Cabecalho t={t} />
      {t.arquivada && (
        <p className="rounded-m bg-superficie-2 px-3 py-2 text-[0.875rem] text-texto-2">Esta tarefa está arquivada.</p>
      )}
      <Propriedades t={t} />
      <Descricao t={t} />
      <section aria-labelledby="pessoas" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="pessoas" className={rotulo}>
            Responsáveis e tarefas por pessoa
          </h2>
          {podeEditar && <AtribuirPessoa t={t} />}
        </div>
        {semResponsavel && (
          <p className="flex items-center gap-2 rounded-m bg-alerta-fundo px-3 py-2 text-[0.875rem] text-alerta">
            <AlertTriangle aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
            Sem responsável. Toda tarefa aberta precisa de pelo menos um.
          </p>
        )}
        {t.atribuicoes.length === 0 ? (
          <p className="text-[0.875rem] text-texto-2">Ninguém atribuído ainda.</p>
        ) : (
          t.atribuicoes.map((a) => <BlocoPessoa key={a.id} a={a} />)
        )}
      </section>
      <Documentos t={t} />
      <ComentariosEHistorico t={t} />
    </div>
  );
}

// ------------------------------------------------------------------ cabeçalho

function Cabecalho({ t }: { t: TarefaCompleta }) {
  const { podeEditar, semanas, avisar } = usePainel();
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(t.titulo);
  const [, rodar] = useRodar();
  useEffect(() => setTitulo(t.titulo), [t.titulo]);

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
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Status"
          value={t.status}
          disabled={!podeEditar}
          onChange={(e) => rodar(() => acoes.atualizarTarefa(t.id, { status: e.target.value as Status }), `Movida para ${rotuloStatus(e.target.value as Status)}.`)}
          className={cn(estiloControle, "h-9 w-auto pr-8 font-medium")}
        >
          {STATUS.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.rotulo}
            </option>
          ))}
        </select>
        <Prazo prazo={t.prazo} status={t.status} />
        <Menu.Root>
          <Menu.Trigger aria-label="Mais ações" className="ml-auto rounded-p p-2 text-texto-2 hover:bg-superficie-2 hover:text-texto">
            <MoreHorizontal aria-hidden strokeWidth={1.75} className="size-[18px]" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={4} className="z-50 min-w-52 rounded-m border border-linha bg-superficie p-1.5 shadow-flutuante">
              {podeEditar && (
                <ItemMenu
                  onSelect={async () => {
                    const id = await rodar(() => acoes.duplicarTarefa(t.id), "Tarefa duplicada.");
                    if (id) router.push(`/painel/tarefas/${id}`);
                  }}
                >
                  <Copy aria-hidden strokeWidth={1.75} className="size-4" /> Duplicar
                </ItemMenu>
              )}
              {podeEditar && (
                <Menu.Sub>
                  <Menu.SubTrigger className="flex h-9 cursor-pointer items-center gap-2.5 rounded-p px-2 text-[0.9375rem] text-texto outline-none data-[highlighted]:bg-superficie-2">
                    <span aria-hidden className="size-4" /> Mover para semana…
                  </Menu.SubTrigger>
                  <Menu.Portal>
                    <Menu.SubContent className="z-50 max-h-72 overflow-y-auto rounded-m border border-linha bg-superficie p-1.5 shadow-flutuante">
                      {semanas.map((s) => (
                        <ItemMenu key={s.numero} onSelect={() => rodar(() => acoes.atualizarTarefa(t.id, { semana: s.numero }), `Movida para a semana ${s.numero}.`)}>
                          Semana {s.numero}
                        </ItemMenu>
                      ))}
                    </Menu.SubContent>
                  </Menu.Portal>
                </Menu.Sub>
              )}
              <ItemMenu
                onSelect={() => {
                  navigator.clipboard?.writeText(`${window.location.origin}/painel/tarefas/${t.id}`);
                  avisar("Link copiado.");
                }}
              >
                <Link2 aria-hidden strokeWidth={1.75} className="size-4" /> Copiar link
              </ItemMenu>
              {podeEditar && (
                <ItemMenu
                  onSelect={() =>
                    rodar(
                      () => acoes.atualizarTarefa(t.id, { arquivada: !t.arquivada }),
                      t.arquivada ? "Tarefa restaurada." : "Tarefa arquivada.",
                    )
                  }
                >
                  {t.arquivada ? (
                    <ArchiveRestore aria-hidden strokeWidth={1.75} className="size-4" />
                  ) : (
                    <Archive aria-hidden strokeWidth={1.75} className="size-4" />
                  )}
                  {t.arquivada ? "Restaurar" : "Arquivar"}
                </ItemMenu>
              )}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </header>
  );
}

function ItemMenu({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className="flex h-9 cursor-pointer items-center gap-2.5 rounded-p px-2 text-[0.9375rem] text-texto outline-none data-[highlighted]:bg-superficie-2"
    >
      {children}
    </Menu.Item>
  );
}

// ------------------------------------------------------------------ propriedades

function Propriedades({ t }: { t: TarefaCompleta }) {
  const { podeEditar, semanas, etiquetas, etiqueta, pessoa } = usePainel();
  const [, rodar] = useRodar();
  const [etqs, setEtqs] = useOptimistic(t.etiquetas);
  const [, iniciar] = useTransition();
  const linha = "grid grid-cols-[120px_1fr] items-center gap-3 min-h-9";
  const criador = pessoa(t.criado_por);

  return (
    <section aria-label="Propriedades" className="flex flex-col gap-1.5">
      <div className={linha}>
        <span className="text-[0.875rem] text-texto-2">Semana</span>
        <select
          value={t.semana ?? ""}
          disabled={!podeEditar}
          onChange={(e) => rodar(() => acoes.atualizarTarefa(t.id, { semana: e.target.value ? Number(e.target.value) : null }))}
          className={cn(estiloControle, "h-9 w-auto")}
        >
          <option value="">Sem semana</option>
          {semanas.map((s) => (
            <option key={s.numero} value={s.numero}>
              Semana {s.numero}
            </option>
          ))}
        </select>
      </div>
      <div className={linha}>
        <span className="text-[0.875rem] text-texto-2">Prazo</span>
        <input
          type="date"
          value={paraCampoData(t.prazo)}
          disabled={!podeEditar}
          onChange={(e) => rodar(() => acoes.atualizarTarefa(t.id, { prazo: deCampoData(e.target.value) }))}
          className={cn(estiloControle, "h-9 w-auto")}
          aria-label="Prazo"
        />
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
                          className="size-4 accent-[var(--botao-primario)]"
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
      <div className={linha}>
        <span className="text-[0.875rem] text-texto-2">Entrega</span>
        <label className="flex items-center gap-2 text-[0.9375rem] text-texto">
          <input
            type="checkbox"
            checked={t.ligada_entrega}
            disabled={!podeEditar}
            onChange={(e) => rodar(() => acoes.atualizarTarefa(t.id, { ligada_entrega: e.target.checked }))}
            className="size-4 accent-[var(--botao-primario)]"
          />
          Ligada à entrega do programa
        </label>
      </div>
      <div className={linha}>
        <span className="text-[0.875rem] text-texto-2">Origem</span>
        <span className="text-[0.875rem] text-texto-2">
          {ORIGENS[t.origem]}
          {criador && ` · criada por ${criador.apelido ?? criador.nome}`}
          {` · ${dataHora(t.criado_em)}`}
        </span>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ descrição

function Descricao({ t }: { t: TarefaCompleta }) {
  const { podeEditar } = usePainel();
  const [editando, setEditando] = useState(false);
  const [aba, setAba] = useState<"escrever" | "ver">("escrever");
  const [texto, setTexto] = useState(t.descricao ?? "");
  const [pendente, rodar] = useRodar();
  useEffect(() => setTexto(t.descricao ?? ""), [t.descricao]);

  return (
    <section aria-labelledby="descricao" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="descricao" className={rotulo}>
          Descrição
        </h2>
        {podeEditar && !editando && (
          <button type="button" onClick={() => setEditando(true)} className="link text-[0.875rem]">
            {t.descricao ? "Editar" : "Escrever"}
          </button>
        )}
      </div>
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
      ) : t.descricao ? (
        <Markdown texto={t.descricao} />
      ) : (
        <p className="text-[0.875rem] text-texto-2">Sem descrição.</p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ pessoas e itens

function AtribuirPessoa({ t }: { t: TarefaCompleta }) {
  const { ativas } = usePainel();
  const [aberto, setAberto] = useState(false);
  const [, rodar] = useRodar();
  const livres = ativas.filter((p) => !t.atribuicoes.some((a) => a.pessoa_id === p.id));
  const temResponsavel = t.atribuicoes.some((a) => a.papel === "responsavel");
  return (
    <Popover.Root open={aberto} onOpenChange={setAberto}>
      <Popover.Trigger asChild>
        <Botao variante="secundario" tamanho="painel" disabled={!livres.length}>
          <UserPlus aria-hidden /> Atribuir pessoa
        </Botao>
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

  const feitos = a.itens.filter((i) => i.feito).length;

  return (
    <div className="rounded-m border border-linha bg-superficie p-3">
      <div className="flex items-center gap-2.5">
        <Avatar pessoa={p} tamanho={28} />
        <span className="min-w-0 flex-1 truncate font-semibold text-texto">{p?.nome ?? "Pessoa removida"}</span>
        {a.itens.length > 0 && (
          <span className="t-dado text-[0.8125rem] text-texto-2">
            {feitos}/{a.itens.length}
          </span>
        )}
        <select
          aria-label={`Papel de ${p?.nome}`}
          value={a.papel}
          disabled={!podeEditar}
          onChange={(e) => rodar(() => acoes.mudarPapel(a.id, e.target.value as "responsavel" | "apoio"))}
          className={cn(estiloControle, "h-8 w-auto py-0 pr-7 text-[0.8125rem]")}
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
          className="mt-0.5 cursor-grab touch-none rounded-p text-texto-2 opacity-40 group-hover:opacity-100 focus-visible:opacity-100"
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
        className="mt-0.5 size-4 shrink-0 accent-[var(--botao-primario)]"
      />
      {editando ? (
        <input
          autoFocus
          value={texto}
          maxLength={500}
          onChange={(e) => setTexto(e.target.value)}
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
          className="rounded-p p-0.5 text-texto-2 opacity-0 group-hover:opacity-100 hover:text-erro focus-visible:opacity-100"
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

function Documentos({ t }: { t: TarefaCompleta }) {
  const { podeEditar } = usePainel();
  const [aberto, setAberto] = useState(false);
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoDocumento>("outro");
  const [pendente, rodar] = useRodar();
  const valida = /^https:\/\/(drive|docs)\.google\.com\//.test(url);

  return (
    <section aria-labelledby="documentos" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="documentos" className={rotulo}>
          Documentos
        </h2>
        {podeEditar && !aberto && (
          <button type="button" onClick={() => setAberto(true)} className="link inline-flex items-center gap-1 text-[0.875rem]">
            <Plus aria-hidden strokeWidth={2} className="size-3.5" /> Adicionar documento
          </button>
        )}
      </div>
      {t.lista_documentos.length > 0 ? (
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
                    className="rounded-p p-1 text-texto-2 opacity-0 group-hover:opacity-100 hover:text-erro focus-visible:opacity-100"
                  >
                    <Trash2 aria-hidden strokeWidth={1.75} className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        !aberto && <p className="text-[0.875rem] text-texto-2">Nenhum documento ligado.</p>
      )}
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
    </section>
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
                          className="ml-2 text-texto-2 opacity-0 group-hover:opacity-100 hover:text-erro focus-visible:opacity-100"
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

