"use client";

import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  CalendarDays,
  ExternalLink,
  ListChecks,
  ListPlus,
  MapPin,
  MessageSquare,
  Paperclip,
  Pencil,
  PencilLine,
  SquarePlus,
  UserMinus,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { aprovarProposta, editarProposta, recusarProposta } from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import type { Pedido } from "@/lib/api/servico";
import { dataHora, dataHoraComAno, fimDaSemanaIso } from "@/lib/painel/datas";
import {
  mudancasDaTarefa,
  prepararEdicao,
  resumirProposta,
  textoPapel,
  textoPrazoProposto,
  textoTipoDocumento,
  type DadosDe,
} from "@/lib/painel/propostas";
import { normalizar } from "@/lib/painel/trello";
import { rotuloStatus, type Proposta } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { iconeDocumento } from "./detalhe-tarefa";
import { EdicaoProposta } from "./edicao-proposta";
import { Avatar, ChipEtiqueta, EstadoVazio } from "./elementos";
import { Markdown } from "./markdown";

// Aprovações (seção 9.10, só admin): o que o Claude pediu com token e ainda não
// entrou no painel. Cada pedido é um cartão no jeito do Quadro, com tudo o que
// ele grava. O admin aprova, recusa ou edita antes de aprovar.

type Operacao = Pedido["operacao"];

const TIPO: Record<Operacao, { Icone: LucideIcon; cor: string }> = {
  criar_tarefa: { Icone: SquarePlus, cor: "bg-ok-fundo text-ok" },
  atualizar_tarefa: { Icone: PencilLine, cor: "bg-info-fundo text-info" },
  atribuir: { Icone: UserPlus, cor: "bg-info-fundo text-info" },
  remover_atribuicao: { Icone: UserMinus, cor: "bg-erro-fundo text-erro" },
  adicionar_item: { Icone: ListPlus, cor: "bg-ok-fundo text-ok" },
  atualizar_item: { Icone: ListChecks, cor: "bg-info-fundo text-info" },
  adicionar_documento: { Icone: Paperclip, cor: "bg-superficie-2 text-texto-2" },
  comentar: { Icone: MessageSquare, cor: "bg-superficie-2 text-texto-2" },
};

const estadoProposta = { pendente: "alerta", aprovada: "ok", recusada: "neutro", falhou: "erro" } as const;

function useNome() {
  const { pessoa } = usePainel();
  return (id: string) => {
    const x = pessoa(id);
    return x?.apelido ?? x?.nome ?? "Pessoa não encontrada";
  };
}

// ------------------------------------------------------------------ peças

function SeloTipo({ operacao, acao }: { operacao: Operacao; acao: string }) {
  const { Icone, cor } = TIPO[operacao];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[0.75rem] font-semibold whitespace-nowrap", cor)}>
      <Icone aria-hidden strokeWidth={2} className="size-3.5" />
      {acao}
    </span>
  );
}

// A caixinha do checklist, só para ver: o item ainda não existe no painel.
function Caixinha({ marcada = false }: { marcada?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-[3px] inline-grid size-[15px] shrink-0 place-content-center rounded-[5px] border-[1.5px]",
        marcada ? "border-botao-primario bg-botao-primario text-botao-primario-texto" : "border-borda-campo",
      )}
    >
      {marcada && <Check strokeWidth={3} className="size-2.5" />}
    </span>
  );
}

function ListaItens({ itens, riscados = false }: { itens: { texto: string; feito?: boolean }[]; riscados?: boolean }) {
  if (!itens.length) return <p className="pl-7 text-[0.8125rem] text-texto-2">Sem itens.</p>;
  return (
    <ul className="flex flex-col gap-1 pl-7">
      {itens.map((i, n) => (
        <li key={n} className="flex items-start gap-2 text-[0.875rem] leading-snug">
          <Caixinha marcada={i.feito} />
          <span className={cn("min-w-0 break-words", riscados ? "text-texto-2 line-through" : "text-texto")}>
            {i.texto}
            {riscados && i.feito && <span className="sr-only"> (feito)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Pessoa({ id, children, riscada = false }: { id: string; children?: React.ReactNode; riscada?: boolean }) {
  const { pessoa } = usePainel();
  const nome = useNome();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <Avatar pessoa={pessoa(id) ?? { nome: nome(id), cor: "var(--texto-2)" }} tamanho={20} />
      <span className={cn("text-[0.875rem] font-semibold", riscada ? "text-texto-2 line-through" : "text-texto")}>{nome(id)}</span>
      {children && <span className="text-[0.8125rem] text-texto-2">{children}</span>}
    </div>
  );
}

function Documento({ d }: { d: { titulo: string; url: string; tipo?: DadosDe<"adicionar_documento">["tipo"] } }) {
  const Icone = iconeDocumento(d.url);
  return (
    <div className="flex items-start gap-2.5 rounded-m border border-linha px-3 py-2">
      <Icone aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0 text-texto-2" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] font-medium break-words text-texto">
          {d.titulo} <span className="font-normal text-texto-2">· {textoTipoDocumento(d.tipo)}</span>
        </p>
        <a href={d.url} target="_blank" rel="noreferrer" className="link t-dado block truncate text-[0.75rem]">
          {d.url}
        </a>
      </div>
    </div>
  );
}

function Detalhe({ Icone, children, className }: { Icone: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[0.8125rem] text-texto-2", className)}>
      <Icone aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

// Descrição e comentário em Markdown, como na tarefa; os longos começam fechados.
function TextoLongo({ texto, className }: { texto: string; className?: string }) {
  const [inteiro, setInteiro] = useState(false);
  const longo = texto.length > 280 || texto.split("\n").length > 6;
  return (
    <div className={className}>
      <div className={cn(longo && !inteiro && "max-h-28 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]")}>
        <Markdown texto={texto} className="text-[0.875rem]" />
      </div>
      {longo && (
        <button type="button" onClick={() => setInteiro(!inteiro)} className="link mt-1 text-[0.8125rem]">
          {inteiro ? "Ver menos" : "Ver tudo"}
        </button>
      )}
    </div>
  );
}

function Etiquetas({ nomes, riscadas = false }: { nomes: string[]; riscadas?: boolean }) {
  const { etiquetas } = usePainel();
  if (!nomes.length) return <span className="text-[0.875rem] text-texto-2">nenhuma</span>;
  return (
    <span className={cn("inline-flex flex-wrap gap-1.5", riscadas && "opacity-60 [&>span]:line-through")}>
      {nomes.map((n) => {
        const e = etiquetas.find((x) => normalizar(x.nome) === normalizar(n));
        return <ChipEtiqueta key={n} etiqueta={e ?? { id: n, nome: n, token: "" }} />;
      })}
    </span>
  );
}

// Título da tarefa em que a proposta mexe; abre a tarefa na janela, como no Quadro.
function TarefaAlvo({ p }: { p: Proposta }) {
  if (!p.tarefa_titulo || !p.tarefa_id)
    return <h3 className="font-titulo text-[1.0625rem] font-semibold text-texto-2 italic">Uma tarefa que não existe mais</h3>;
  return (
    <h3 className="font-titulo text-[1.0625rem] leading-snug font-semibold break-words">
      <Link href={`/painel/tarefas/${p.tarefa_id}`} scroll={false} className="text-texto hover:underline">
        {p.tarefa_titulo}
      </Link>
    </h3>
  );
}

// ------------------------------------------------------------------ cartões por tipo

function VisaoTarefaNova({ d }: { d: DadosDe<"criar_tarefa"> }) {
  const { semanas } = usePainel();
  const fim = d.semana ? semanas.find((s) => s.numero === d.semana)?.fim : null;
  const prazo = d.prazo
    ? textoPrazoProposto(d.prazo)
    : fim
      ? `${dataHoraComAno(fimDaSemanaIso(fim))} (fim da semana)`
      : "sem prazo";
  const atribuicoes = d.atribuicoes ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {(d.etiquetas?.length || d.ligada_entrega) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {d.ligada_entrega && (
              <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-caramelo/15 px-2 text-[0.75rem] font-medium text-link">
                <MapPin aria-hidden strokeWidth={2} className="size-3" />
                ligada à entrega
              </span>
            )}
            <Etiquetas nomes={d.etiquetas ?? []} />
          </div>
        )}
        <h3 className="font-titulo text-[1.0625rem] leading-snug font-semibold break-words text-texto">{d.titulo}</h3>
        {d.descricao && <TextoLongo texto={d.descricao} />}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Detalhe Icone={Clock}>{prazo}</Detalhe>
        <Detalhe Icone={CalendarDays}>{d.semana ? `Semana ${d.semana}` : "sem semana"}</Detalhe>
        <Chip>{rotuloStatus(d.status ?? "a_fazer")}</Chip>
        {d.origem === "reuniao" && <Detalhe Icone={Users}>da reunião</Detalhe>}
      </div>
      <div className="flex flex-col gap-2.5 border-t border-linha pt-3">
        {atribuicoes.length === 0 && <p className="text-[0.875rem] text-texto-2">Ninguém atribuído.</p>}
        {atribuicoes.map((a) => (
          <div key={a.pessoa} className="flex flex-col gap-1">
            <Pessoa id={a.pessoa}>{textoPapel(a.papel)}</Pessoa>
            <ListaItens itens={(a.itens ?? []).map((texto) => ({ texto }))} />
          </div>
        ))}
      </div>
      {(d.documentos?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1.5">
          {d.documentos!.map((doc, n) => (
            <Documento key={n} d={doc} />
          ))}
        </div>
      )}
    </div>
  );
}

function VisaoAlteracao({ p, d }: { p: Proposta; d: DadosDe<"atualizar_tarefa"> }) {
  const mudancas = mudancasDaTarefa({ status: p.status, atual: p.atual, dados: d });
  const atual = p.status === "pendente" ? p.atual : null;
  return (
    <div className="flex flex-col gap-3">
      <TarefaAlvo p={p} />
      <dl className="flex flex-col divide-y divide-linha rounded-m border border-linha">
        {mudancas.map((m) => (
          <div key={m.campo} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3">
            <dt className="text-[0.8125rem] font-semibold text-texto-2 sm:pt-px">{m.rotulo}</dt>
            <dd className="min-w-0">
              {m.campo === "etiquetas" ? (
                <span className="flex flex-wrap items-center gap-2">
                  {atual && (
                    <>
                      <Etiquetas nomes={atual.etiquetas} riscadas />
                      <ArrowRight aria-label="passa a ser" strokeWidth={1.75} className="size-3.5 text-texto-2" />
                    </>
                  )}
                  <Etiquetas nomes={d.campos.etiquetas ?? []} />
                </span>
              ) : m.campo === "descricao" ? (
                <div className="flex flex-col gap-2">
                  {m.atual !== undefined && (
                    <p className="max-h-24 overflow-y-auto text-[0.8125rem] break-words whitespace-pre-wrap text-texto-2 line-through decoration-texto-2/50">
                      {m.atual}
                    </p>
                  )}
                  <p className="max-h-60 overflow-y-auto text-[0.875rem] break-words whitespace-pre-wrap text-texto">{m.proposto}</p>
                </div>
              ) : (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.875rem]">
                  {m.atual !== undefined && (
                    <>
                      <span className="break-words text-texto-2 line-through decoration-texto-2/50">{m.atual}</span>
                      <ArrowRight aria-label="passa a ser" strokeWidth={1.75} className="size-3.5 shrink-0 text-texto-2" />
                    </>
                  )}
                  <span className="font-semibold break-words text-texto">{m.proposto}</span>
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function VisaoAtribuicao({ p, d }: { p: Proposta; d: DadosDe<"atribuir"> }) {
  const agora = p.status === "pendente" ? p.papel_atual : null;
  const novo = d.papel ?? agora;
  return (
    <div className="flex flex-col gap-3">
      <TarefaAlvo p={p} />
      <div className="flex flex-col gap-1">
        <Pessoa id={d.pessoa}>
          {agora && novo !== agora ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="line-through">{textoPapel(agora)}</span>
              <ArrowRight aria-label="passa a ser" strokeWidth={1.75} className="size-3.5" />
              <span className="font-semibold text-texto">{textoPapel(novo)}</span>
            </span>
          ) : (
            textoPapel(novo)
          )}
        </Pessoa>
        {agora && <p className="pl-7 text-[0.75rem] text-texto-2">Já está na tarefa. Os itens abaixo entram junto aos dela.</p>}
        <ListaItens itens={(d.itens ?? []).map((texto) => ({ texto }))} />
      </div>
    </div>
  );
}

function VisaoSaida({ p, d }: { p: Proposta; d: DadosDe<"remover_atribuicao"> }) {
  const itens = p.status === "pendente" ? (p.itens_da_pessoa ?? []) : [];
  return (
    <div className="flex flex-col gap-3">
      <TarefaAlvo p={p} />
      <div className="flex flex-col gap-1">
        <Pessoa id={d.pessoa} riscada>
          sai da tarefa{p.status === "pendente" && p.papel_atual ? ` (hoje: ${textoPapel(p.papel_atual)})` : ""}
        </Pessoa>
        {itens.length > 0 && <ListaItens itens={itens} riscados />}
      </div>
    </div>
  );
}

function VisaoItemNovo({ p, d }: { p: Proposta; d: DadosDe<"adicionar_item"> }) {
  return (
    <div className="flex flex-col gap-3">
      <TarefaAlvo p={p} />
      <div className="flex flex-col gap-1">
        <Pessoa id={d.pessoa}>{p.status === "pendente" && p.papel_atual ? textoPapel(p.papel_atual) : null}</Pessoa>
        <ListaItens itens={[{ texto: d.texto }]} />
      </div>
    </div>
  );
}

function VisaoItem({ p, d }: { p: Proposta; d: DadosDe<"atualizar_item"> }) {
  const antes = p.item_texto ?? "um item que não existe mais";
  return (
    <div className="flex flex-col gap-3">
      <TarefaAlvo p={p} />
      <div className="flex items-start gap-2 rounded-m border border-linha px-3 py-2.5 text-[0.875rem] leading-snug">
        <Caixinha marcada={d.feito} />
        <span className="flex min-w-0 flex-col gap-0.5">
          {d.texto !== undefined ? (
            <>
              <span className="break-words text-texto-2 line-through decoration-texto-2/50">{antes}</span>
              <span className="font-semibold break-words text-texto">{d.texto}</span>
            </>
          ) : (
            <span className={cn("break-words", p.item_texto ? "text-texto" : "text-texto-2 italic")}>{antes}</span>
          )}
          {d.feito !== undefined && (
            <span className="text-[0.75rem] text-texto-2">{d.feito ? "fica marcado como feito" : "fica desmarcado"}</span>
          )}
        </span>
      </div>
    </div>
  );
}

function VisaoComentario({ p, d }: { p: Proposta; d: DadosDe<"comentar"> }) {
  return (
    <div className="flex flex-col gap-3">
      <TarefaAlvo p={p} />
      <div className="rounded-m bg-superficie-2 px-3 py-2.5">
        <p className="mb-1 text-[0.75rem] font-semibold text-texto-2">Claude comenta</p>
        <TextoLongo texto={d.texto} />
      </div>
    </div>
  );
}

function VisaoProposta({ p }: { p: Proposta }) {
  switch (p.operacao) {
    case "criar_tarefa":
      return <VisaoTarefaNova d={p.dados} />;
    case "atualizar_tarefa":
      return <VisaoAlteracao p={p} d={p.dados} />;
    case "atribuir":
      return <VisaoAtribuicao p={p} d={p.dados} />;
    case "remover_atribuicao":
      return <VisaoSaida p={p} d={p.dados} />;
    case "adicionar_item":
      return <VisaoItemNovo p={p} d={p.dados} />;
    case "atualizar_item":
      return <VisaoItem p={p} d={p.dados} />;
    case "adicionar_documento":
      return (
        <div className="flex flex-col gap-3">
          <TarefaAlvo p={p} />
          <Documento d={p.dados} />
        </div>
      );
    case "comentar":
      return <VisaoComentario p={p} d={p.dados} />;
  }
}

// ------------------------------------------------------------------ pendente

function CartaoPendente({ proposta: p }: { proposta: Proposta }) {
  const { avisar } = usePainel();
  const nome = useNome();
  const [ocupado, iniciar] = useTransition();
  const [rascunho, setRascunho] = useState<Pedido | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const editavel = p.operacao !== "remover_atribuicao";

  // Na edição, o aviso segue o rascunho (trocar a semana sem prazo, por
  // exemplo). Quem não está na tarefa só se sabe pelo servidor: com outra
  // pessoa no item, o aviso volta depois de salvar.
  const outraPessoa =
    rascunho?.operacao === "adicionar_item" && rascunho.dados.pessoa !== (p.dados as DadosDe<"adicionar_item">).pessoa;
  const r = resumirProposta(rascunho && !outraPessoa ? ({ ...p, ...rascunho } as Proposta) : p, nome);
  const aviso = outraPessoa ? undefined : r.aviso;

  const aprovarAgora = async () => {
    const a = await aprovarProposta(p.id);
    if (!a.ok) avisar(a.erro, { erro: true });
    else if (a.dado.status === "falhou") avisar(`Não deu para aplicar: ${a.dado.erro}`, { erro: true });
    else avisar("Aprovada. A mudança já está no painel.");
  };

  const aprovar = () => iniciar(aprovarAgora);

  const recusar = () =>
    iniciar(async () => {
      const x = await recusarProposta(p.id);
      if (!x.ok) avisar(x.erro, { erro: true });
      else avisar("Recusada. Nada mudou no painel.");
    });

  const salvar = (eAprovar: boolean) => {
    if (!rascunho) return;
    const preparo = prepararEdicao(rascunho);
    if (!preparo.ok) {
      setErro(preparo.erro);
      return;
    }
    iniciar(async () => {
      const e = await editarProposta(p.id, preparo.dados);
      if (!e.ok) {
        setErro(e.erro);
        return;
      }
      setRascunho(null);
      setErro(null);
      if (eAprovar) await aprovarAgora();
      else avisar("Edição salva. A proposta continua esperando a sua aprovação.");
    });
  };

  const cancelar = () => {
    setRascunho(null);
    setErro(null);
  };

  return (
    <li
      id={`proposta-${p.id}`}
      aria-label={r.titulo}
      className={cn(
        "flex min-w-0 scroll-mt-20 flex-col rounded-g border bg-superficie shadow-cartao transition-colors",
        rascunho ? "border-caramelo md:col-span-2" : "border-linha",
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3.5">
        <SeloTipo operacao={p.operacao} acao={r.acao} />
        {rascunho && <span className="text-[0.8125rem] font-semibold text-link">Editando</span>}
        <span className="t-dado ml-auto text-[0.75rem] text-texto-2" title={dataHoraComAno(p.criado_em)}>
          {p.token_nome ?? "Token apagado"} · {dataHora(p.criado_em)}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-4">
        {rascunho ? (
          <>
            {p.operacao !== "criar_tarefa" && <TarefaAlvo p={p} />}
            <EdicaoProposta
              proposta={p}
              pedido={rascunho}
              mudar={(novo) => {
                setRascunho(novo);
                setErro(null);
              }}
            />
          </>
        ) : (
          <VisaoProposta p={p} />
        )}
        {aviso && <p className="rounded-m bg-alerta-fundo px-3 py-2 text-[0.8125rem] text-alerta">{aviso}</p>}
        {erro && (
          <p role="alert" className="rounded-m bg-erro-fundo px-3 py-2 text-[0.8125rem] text-erro">
            {erro}
          </p>
        )}
      </div>
      <footer className="flex flex-wrap items-center gap-2 border-t border-linha px-4 py-3">
        {rascunho ? (
          <>
            <Botao tamanho="painel" disabled={ocupado} onClick={() => salvar(true)}>
              <Check aria-hidden /> Salvar e aprovar
            </Botao>
            <Botao variante="secundario" tamanho="painel" disabled={ocupado} onClick={() => salvar(false)}>
              Só salvar
            </Botao>
            <Botao variante="fantasma" tamanho="painel" disabled={ocupado} onClick={cancelar} className="ml-auto">
              Cancelar
            </Botao>
          </>
        ) : (
          <>
            <Botao tamanho="painel" disabled={ocupado} onClick={aprovar}>
              <Check aria-hidden /> Aprovar
            </Botao>
            {editavel && (
              <Botao
                variante="secundario"
                tamanho="painel"
                disabled={ocupado}
                onClick={() => setRascunho({ operacao: p.operacao, dados: structuredClone(p.dados) } as Pedido)}
              >
                <Pencil aria-hidden /> Editar
              </Botao>
            )}
            <Botao variante="fantasma" tamanho="painel" disabled={ocupado} onClick={recusar} className="ml-auto hover:text-erro">
              <X aria-hidden /> Recusar
            </Botao>
          </>
        )}
      </footer>
    </li>
  );
}

// ------------------------------------------------------------------ decididas

function LinhaDecidida({ proposta: p }: { proposta: Proposta }) {
  const nome = useNome();
  const [aberta, setAberta] = useState(false);
  const r = resumirProposta(p, nome);
  const quem = p.decidido_por ? nome(p.decidido_por) : null;
  const { Icone } = TIPO[p.operacao];
  return (
    <li id={`proposta-${p.id}`} className="scroll-mt-20">
      <div className="flex items-start gap-3 px-4 py-3">
        <Icone aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0 text-texto-2" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <h3 className="min-w-0 text-[0.9375rem] font-medium break-words text-texto">{r.titulo}</h3>
            <Chip estado={estadoProposta[p.status]}>{p.status}</Chip>
          </div>
          <p className="t-dado mt-0.5 text-[0.75rem] text-texto-2">
            {p.token_nome ?? "Token apagado"} · {dataHora(p.criado_em)}
            {p.decidido_em && quem && ` · ${p.status} por ${quem} em ${dataHora(p.decidido_em)}`}
          </p>
          {p.erro && <p className="mt-2 rounded-m bg-erro-fundo px-3 py-2 text-[0.8125rem] text-erro">{p.erro}</p>}
          <div className="mt-1.5 flex flex-wrap gap-x-4 text-[0.8125rem]">
            <button
              type="button"
              aria-expanded={aberta}
              onClick={() => setAberta(!aberta)}
              className="inline-flex items-center gap-1 text-texto-2 hover:text-texto"
            >
              <ChevronDown aria-hidden strokeWidth={1.75} className={cn("size-3.5 transition-transform", aberta && "rotate-180")} />
              {aberta ? "Esconder o pedido" : "Ver o pedido"}
            </button>
            {p.tarefa_id && p.tarefa_titulo && (
              <Link href={`/painel/tarefas/${p.tarefa_id}`} scroll={false} className="inline-flex items-center gap-1 text-texto-2 hover:text-texto">
                <ExternalLink aria-hidden strokeWidth={1.75} className="size-3.5" /> Ver a tarefa
              </Link>
            )}
          </div>
          {aberta && (
            <div className="mt-3 rounded-m border border-linha bg-superficie p-3">
              <VisaoProposta p={p} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// ------------------------------------------------------------------ página

export function PaginaAprovacoes({ pendentes, decididas }: { pendentes: Proposta[]; decididas: Proposta[] }) {
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="titulo-pendentes" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="titulo-pendentes" className="flex items-center gap-2 font-titulo text-[1.0625rem] font-semibold text-texto">
            Aguardando você
            {pendentes.length > 0 && (
              <span className="t-dado inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-alerta-fundo px-1.5 text-[0.75rem] text-alerta">
                {pendentes.length}
              </span>
            )}
          </h2>
          {pendentes.length > 0 && (
            <p className="text-[0.875rem] text-texto-2">
              Cada cartão mostra o que entra no painel se você aprovar. Para ajustar antes, use Editar.
            </p>
          )}
        </div>
        {pendentes.length === 0 ? (
          <EstadoVazio texto="Quando o Claude pedir uma mudança, ela aparece aqui. Nada entra no painel sem a sua aprovação." />
        ) : (
          <ul className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            {pendentes.map((p) => (
              <CartaoPendente key={p.id} proposta={p} />
            ))}
          </ul>
        )}
      </section>

      {decididas.length > 0 && (
        <section aria-labelledby="titulo-decididas" className="flex flex-col gap-3">
          <h2 id="titulo-decididas" className="font-titulo text-[1.0625rem] font-semibold text-texto">
            Decididas
          </h2>
          <ul className="flex flex-col divide-y divide-linha rounded-g border border-linha bg-superficie">
            {decididas.map((p) => (
              <LinhaDecidida key={p.id} proposta={p} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
