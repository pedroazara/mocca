"use client";

import * as Popover from "@radix-ui/react-popover";
import { Plus, UserPlus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { estiloControle } from "@/components/ui/campo";
import type { Pedido } from "@/lib/api/servico";
import { dataHoraComAno, deCampoData, fimDaSemanaIso, paraCampoData } from "@/lib/painel/datas";
import {
  CAMPOS_TAREFA,
  mudancasDaTarefa,
  PAPEIS,
  textoPapel,
  type CampoTarefa,
  type DadosDe,
} from "@/lib/painel/propostas";
import { normalizar } from "@/lib/painel/trello";
import { STATUS, TIPOS_DOCUMENTO, type PapelAtribuicao, type Proposta, type Status, type TarefaAtual } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { Avatar, ChipEtiqueta } from "./elementos";

// Edição de uma proposta do Claude antes de aprovar (seção 9.10). O formulário
// muda só o rascunho do cartão; o cartão limpa e manda tudo de uma vez ao
// salvar, e o servidor confere de novo. A tarefa, o item e a pessoa de uma
// atribuição não mudam: isso seria outro pedido.

const controle = cn(estiloControle, "h-9 text-[0.9375rem]");
const rotulo = "text-[0.8125rem] font-semibold text-texto";

function Rotulo({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={rotulo}>
      {children}
    </label>
  );
}

function BotaoAdicionar({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-p px-1 py-1 text-[0.8125rem] text-texto-2 hover:text-texto disabled:opacity-50",
        props.className,
      )}
    >
      <Plus aria-hidden strokeWidth={2} className="size-3.5" />
      {children}
    </button>
  );
}

function BotaoTirar({ rotulo: r, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={r} title={r} onClick={onClick} className="shrink-0 rounded-p p-1.5 text-texto-2 hover:bg-superficie-2 hover:text-erro">
      <X aria-hidden strokeWidth={1.75} className="size-4" />
    </button>
  );
}

// ------------------------------------------------------------------ controles

function SeletorStatus({ valor, mudar }: { valor: Status; mudar: (s: Status) => void }) {
  return (
    <div role="group" aria-label="Status" className="flex w-full gap-1 rounded-m bg-superficie-2 p-1 sm:w-fit">
      {STATUS.map((s) => (
        <button
          key={s.valor}
          type="button"
          aria-pressed={valor === s.valor}
          onClick={() => mudar(s.valor)}
          className={cn(
            "flex-1 rounded-p px-2 py-1 text-[0.8125rem] whitespace-nowrap sm:flex-none sm:px-3",
            valor === s.valor ? "bg-superficie font-semibold text-texto shadow-cartao" : "text-texto-2 hover:text-texto",
          )}
        >
          {s.rotulo}
        </button>
      ))}
    </div>
  );
}

function CampoSemana({ id, valor, mudar }: { id: string; valor: number | null | undefined; mudar: (v: number | null) => void }) {
  const { semanas } = usePainel();
  return (
    <select id={id} value={valor ?? ""} onChange={(e) => mudar(e.target.value ? Number(e.target.value) : null)} className={controle}>
      <option value="">Sem semana</option>
      {semanas.map((s) => (
        <option key={s.numero} value={s.numero}>
          Semana {s.numero}
        </option>
      ))}
    </select>
  );
}

// O campo é só de data, como no painel. Sem mexer nele, o prazo segue o do
// pedido, com o horário que o Claude mandou; mudando, vale o fim do dia.
function CampoPrazo({ id, valor, mudar }: { id: string; valor: string | null | undefined; mudar: (v: string | null) => void }) {
  return <input id={id} type="date" value={paraCampoData(valor ?? null)} onChange={(e) => mudar(deCampoData(e.target.value))} className={controle} />;
}

function SeletorEtiquetas({ nomes, mudar }: { nomes: string[]; mudar: (v: string[]) => void }) {
  const { etiquetas } = usePainel();
  const marcada = (nome: string) => nomes.some((n) => normalizar(n) === normalizar(nome));
  // renomeada ou apagada depois do pedido: aparece para o admin poder tirar
  const soltas = nomes.filter((n) => !etiquetas.some((e) => normalizar(e.nome) === normalizar(n)));
  return (
    <div role="group" aria-label="Etiquetas" className="flex flex-wrap gap-2">
      {soltas.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed
          title="Esta etiqueta não existe mais. Clique para tirar."
          onClick={() => mudar(nomes.filter((x) => x !== n))}
          className="inline-flex h-[22px] items-center gap-1 rounded-full bg-erro-fundo px-2 text-[0.75rem] font-medium text-erro line-through ring-2 ring-erro/50 ring-offset-2 ring-offset-superficie"
        >
          {n}
          <X aria-hidden strokeWidth={2} className="size-3" />
        </button>
      ))}
      {etiquetas.map((e) => {
        const sel = marcada(e.nome);
        return (
          <button
            key={e.id}
            type="button"
            aria-pressed={sel}
            onClick={() => mudar(sel ? nomes.filter((n) => normalizar(n) !== normalizar(e.nome)) : [...nomes, e.nome])}
            className={cn(
              "rounded-full ring-offset-2 ring-offset-superficie transition-opacity",
              sel ? "ring-2 ring-texto" : "opacity-60 hover:opacity-100",
            )}
          >
            <ChipEtiqueta etiqueta={e} />
          </button>
        );
      })}
    </div>
  );
}

function CaixaEntrega({ valor, mudar }: { valor: boolean; mudar: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 text-[0.9375rem] text-texto">
      <input type="checkbox" checked={valor} onChange={(e) => mudar(e.target.checked)} />
      Ligada à entrega do programa
    </label>
  );
}

// Itens de uma pessoa. Enter abre o próximo item logo abaixo.
function EditorItens({ itens, mudar, de }: { itens: string[]; mudar: (v: string[]) => void; de: string }) {
  const campos = useRef<(HTMLInputElement | null)[]>([]);
  const [focar, setFocar] = useState<number | null>(null);
  useEffect(() => {
    if (focar === null) return;
    campos.current[focar]?.focus();
    setFocar(null);
  }, [focar, itens.length]);

  const inserir = (pos: number) => {
    mudar([...itens.slice(0, pos), "", ...itens.slice(pos)]);
    setFocar(pos);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {itens.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {itens.map((texto, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <input
                ref={(el) => {
                  campos.current[i] = el;
                }}
                value={texto}
                maxLength={500}
                aria-label={`Item ${i + 1} de ${de}`}
                placeholder="Novo item"
                onChange={(e) => mudar(itens.map((x, n) => (n === i ? e.target.value : x)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    inserir(i + 1);
                  }
                }}
                className={cn(estiloControle, "h-8 text-[0.875rem]")}
              />
              <BotaoTirar rotulo={`Tirar o item ${i + 1} de ${de}`} onClick={() => mudar(itens.filter((_, n) => n !== i))} />
            </li>
          ))}
        </ul>
      )}
      <BotaoAdicionar onClick={() => inserir(itens.length)}>Adicionar item</BotaoAdicionar>
    </div>
  );
}

function AdicionarPessoa({ fora, escolher }: { fora: string[]; escolher: (id: string) => void }) {
  const { ativas } = usePainel();
  const [aberto, setAberto] = useState(false);
  const livres = ativas.filter((p) => !fora.includes(p.id));
  return (
    <Popover.Root open={aberto} onOpenChange={setAberto}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={!livres.length}
          className="inline-flex w-fit items-center gap-1.5 rounded-p px-1 py-1 text-[0.8125rem] text-texto-2 hover:text-texto disabled:opacity-50"
        >
          <UserPlus aria-hidden strokeWidth={1.75} className="size-3.5" /> Adicionar pessoa
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-64 rounded-m border border-linha bg-superficie p-1.5 shadow-flutuante">
          {livres.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setAberto(false);
                escolher(p.id);
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

function SeletorPapel({
  valor,
  mudar,
  pessoa,
  hoje,
}: {
  valor: PapelAtribuicao | undefined;
  mudar: (v: PapelAtribuicao | undefined) => void;
  pessoa: string;
  hoje?: PapelAtribuicao | null;
}) {
  return (
    <select
      aria-label={`Papel de ${pessoa}`}
      value={valor ?? ""}
      onChange={(e) => mudar((e.target.value || undefined) as PapelAtribuicao | undefined)}
      className={cn(estiloControle, "h-8 w-auto py-0 pr-8 pl-2 text-[0.8125rem]")}
    >
      {PAPEIS.map((x) => (
        <option key={x.valor} value={x.valor}>
          {x.valor === "" && hoje ? `manter (${textoPapel(hoje)})` : x.rotulo}
        </option>
      ))}
    </select>
  );
}

// Cópia sem a chave: um campo ausente da proposta é "não muda" (ou, no papel,
// "o servidor escolhe"), diferente de null, que apaga.
function sem<T extends object>(o: T, chave: keyof T): T {
  const copia = { ...o };
  delete copia[chave];
  return copia;
}

const comPapel = <T extends { papel?: PapelAtribuicao }>(a: T, papel: PapelAtribuicao | undefined): T =>
  papel ? { ...a, papel } : sem(a, "papel");

// ------------------------------------------------------------------ tarefa nova

type Atribuicoes = NonNullable<DadosDe<"criar_tarefa">["atribuicoes"]>;
type Documentos = NonNullable<DadosDe<"criar_tarefa">["documentos"]>;

function EditorAtribuicoes({ lista, mudar }: { lista: Atribuicoes; mudar: (v: Atribuicoes) => void }) {
  const { pessoa } = usePainel();
  const trocar = (i: number, a: Atribuicoes[number]) => mudar(lista.map((x, n) => (n === i ? a : x)));
  return (
    <div className="flex flex-col gap-2">
      {lista.length === 0 && <p className="text-[0.875rem] text-texto-2">Ninguém atribuído.</p>}
      {lista.map((a, i) => {
        const p = pessoa(a.pessoa);
        const nome = p?.apelido ?? p?.nome ?? "Pessoa não encontrada";
        return (
          <div key={a.pessoa} className="flex flex-col gap-2 rounded-m border border-linha p-3">
            <div className="flex items-center gap-2">
              <Avatar pessoa={p} tamanho={28} />
              <span className="min-w-0 flex-1 truncate font-semibold text-texto">{nome}</span>
              <SeletorPapel valor={a.papel} pessoa={nome} mudar={(papel) => trocar(i, comPapel(a, papel))} />
              <BotaoTirar rotulo={`Tirar ${nome} da tarefa`} onClick={() => mudar(lista.filter((_, n) => n !== i))} />
            </div>
            <div className="pl-9">
              <EditorItens de={nome} itens={a.itens ?? []} mudar={(itens) => trocar(i, { ...a, itens })} />
            </div>
          </div>
        );
      })}
      <AdicionarPessoa fora={lista.map((a) => a.pessoa)} escolher={(id) => mudar([...lista, { pessoa: id, itens: [] }])} />
    </div>
  );
}

function CamposDocumento({
  d,
  mudar,
  n,
}: {
  d: { titulo: string; url: string; tipo?: DadosDe<"adicionar_documento">["tipo"] };
  mudar: (d: { titulo: string; url: string; tipo?: DadosDe<"adicionar_documento">["tipo"] }) => void;
  n?: number;
}) {
  const id = useId();
  const sufixo = n === undefined ? "" : ` do documento ${n + 1}`;
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
      <div className="flex flex-col gap-1">
        <Rotulo htmlFor={`${id}-titulo`}>Título{sufixo}</Rotulo>
        <input id={`${id}-titulo`} value={d.titulo} maxLength={200} onChange={(e) => mudar({ ...d, titulo: e.target.value })} className={controle} />
      </div>
      <div className="flex flex-col gap-1">
        <Rotulo htmlFor={`${id}-tipo`}>Tipo</Rotulo>
        <select
          id={`${id}-tipo`}
          value={d.tipo ?? "outro"}
          onChange={(e) => mudar({ ...d, tipo: e.target.value as DadosDe<"adicionar_documento">["tipo"] })}
          className={controle}
        >
          {TIPOS_DOCUMENTO.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Rotulo htmlFor={`${id}-url`}>Link{sufixo}</Rotulo>
        <input
          id={`${id}-url`}
          type="url"
          value={d.url}
          placeholder="https://docs.google.com/…"
          onChange={(e) => mudar({ ...d, url: e.target.value })}
          className={cn(controle, "t-dado text-[0.8125rem]")}
        />
      </div>
    </div>
  );
}

function EditorDocumentos({ lista, mudar }: { lista: Documentos; mudar: (v: Documentos) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {lista.map((d, i) => (
        <div key={i} className="flex items-start gap-2 rounded-m border border-linha p-3">
          <div className="min-w-0 flex-1">
            <CamposDocumento n={i} d={d} mudar={(novo) => mudar(lista.map((x, k) => (k === i ? novo : x)))} />
          </div>
          <BotaoTirar rotulo={`Tirar o documento ${i + 1}`} onClick={() => mudar(lista.filter((_, k) => k !== i))} />
        </div>
      ))}
      <BotaoAdicionar onClick={() => mudar([...lista, { titulo: "", url: "", tipo: "outro" }])}>Adicionar documento</BotaoAdicionar>
    </div>
  );
}

function EdicaoTarefaNova({ d, mudar }: { d: DadosDe<"criar_tarefa">; mudar: (d: DadosDe<"criar_tarefa">) => void }) {
  const { semanas } = usePainel();
  const id = useId();
  const fim = d.semana ? semanas.find((s) => s.numero === d.semana)?.fim : null;
  return (
    <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Rotulo htmlFor={`${id}-titulo`}>Título</Rotulo>
          <input
            id={`${id}-titulo`}
            autoFocus
            value={d.titulo}
            maxLength={200}
            onChange={(e) => mudar({ ...d, titulo: e.target.value })}
            className={cn(controle, "font-medium")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Rotulo htmlFor={`${id}-descricao`}>Descrição</Rotulo>
          <textarea
            id={`${id}-descricao`}
            value={d.descricao ?? ""}
            rows={4}
            maxLength={20000}
            placeholder="Aceita **negrito**, *itálico*, listas e links."
            onChange={(e) => mudar({ ...d, descricao: e.target.value })}
            className={cn(estiloControle, "resize-y py-2 text-[0.9375rem] leading-relaxed")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className={rotulo}>Status</span>
          <SeletorStatus valor={d.status ?? "a_fazer"} mudar={(status) => mudar({ ...d, status })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Rotulo htmlFor={`${id}-semana`}>Semana</Rotulo>
            <CampoSemana id={`${id}-semana`} valor={d.semana} mudar={(semana) => mudar({ ...d, semana })} />
          </div>
          <div className="flex flex-col gap-1">
            <Rotulo htmlFor={`${id}-prazo`}>Prazo</Rotulo>
            <CampoPrazo id={`${id}-prazo`} valor={d.prazo} mudar={(prazo) => mudar({ ...d, prazo })} />
          </div>
          <p className="col-span-2 -mt-1 text-[0.75rem] text-texto-2">
            {d.prazo
              ? `Vence em ${dataHoraComAno(d.prazo)}.`
              : fim
                ? `Sem data: vence no fim da semana, ${dataHoraComAno(fimDaSemanaIso(fim))}.`
                : "Sem data e sem semana: a tarefa fica sem prazo."}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={rotulo}>Etiquetas</span>
          <SeletorEtiquetas nomes={d.etiquetas ?? []} mudar={(etiquetas) => mudar({ ...d, etiquetas })} />
        </div>
        <CaixaEntrega valor={Boolean(d.ligada_entrega)} mudar={(ligada_entrega) => mudar({ ...d, ligada_entrega })} />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className={rotulo}>Pessoas e itens</span>
          <EditorAtribuicoes lista={d.atribuicoes ?? []} mudar={(atribuicoes) => mudar({ ...d, atribuicoes })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={rotulo}>Documentos</span>
          <EditorDocumentos lista={d.documentos ?? []} mudar={(documentos) => mudar({ ...d, documentos })} />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ alteração

type Campos = DadosDe<"atualizar_tarefa">["campos"];

// Ao incluir um campo, ele começa com o valor de hoje.
function valorInicial(campo: CampoTarefa, atual: TarefaAtual | null): Campos[CampoTarefa] {
  switch (campo) {
    case "titulo":
      return atual?.titulo ?? "";
    case "descricao":
      return atual?.descricao ?? null;
    case "status":
      return atual?.status ?? "a_fazer";
    case "prazo":
      return atual?.prazo ?? null;
    case "semana":
      return atual?.semana ?? null;
    case "etiquetas":
      return [...(atual?.etiquetas ?? [])];
    case "ligada_entrega":
      return atual?.ligada_entrega ?? false;
  }
}

function EditorCampo({ campo, id, c, mudar }: { campo: CampoTarefa; id: string; c: Campos; mudar: (c: Campos) => void }) {
  switch (campo) {
    case "titulo":
      return <input id={id} value={c.titulo ?? ""} maxLength={200} onChange={(e) => mudar({ ...c, titulo: e.target.value })} className={controle} />;
    case "descricao":
      return (
        <textarea
          id={id}
          value={c.descricao ?? ""}
          rows={4}
          maxLength={20000}
          placeholder="Vazia: a descrição é apagada."
          onChange={(e) => mudar({ ...c, descricao: e.target.value })}
          className={cn(estiloControle, "resize-y py-2 text-[0.9375rem] leading-relaxed")}
        />
      );
    case "status":
      return <SeletorStatus valor={c.status ?? "a_fazer"} mudar={(status) => mudar({ ...c, status })} />;
    case "prazo":
      return <CampoPrazo id={id} valor={c.prazo} mudar={(prazo) => mudar({ ...c, prazo })} />;
    case "semana":
      return <CampoSemana id={id} valor={c.semana} mudar={(semana) => mudar({ ...c, semana })} />;
    case "etiquetas":
      return <SeletorEtiquetas nomes={c.etiquetas ?? []} mudar={(etiquetas) => mudar({ ...c, etiquetas })} />;
    case "ligada_entrega":
      return <CaixaEntrega valor={Boolean(c.ligada_entrega)} mudar={(ligada_entrega) => mudar({ ...c, ligada_entrega })} />;
  }
}

function EdicaoAlteracao({ p, d, mudar }: { p: Proposta; d: DadosDe<"atualizar_tarefa">; mudar: (d: DadosDe<"atualizar_tarefa">) => void }) {
  const id = useId();
  const c = d.campos;
  const hoje = new Map(mudancasDaTarefa({ status: p.status, atual: p.atual, dados: d }).map((m) => [m.campo, m.atual]));
  const incluidos = CAMPOS_TAREFA.filter(({ campo }) => c[campo] !== undefined);
  const fora = CAMPOS_TAREFA.filter(({ campo }) => c[campo] === undefined);
  const trocar = (campos: Campos) => mudar({ ...d, campos });
  const tirar = (campo: CampoTarefa) => trocar(sem(c, campo));

  return (
    <div className="flex flex-col gap-3">
      {incluidos.length === 0 && <p className="text-[0.875rem] text-texto-2">Nenhum campo muda. Escolha abaixo o que mudar, ou recuse a proposta.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {incluidos.map(({ campo, rotulo: r }) => {
          const largo = campo === "descricao" || campo === "titulo" || campo === "etiquetas";
          const vazioPrazo = campo === "prazo" && !c.prazo;
          return (
            <div key={campo} className={cn("flex flex-col gap-1.5 rounded-m border border-linha p-3", largo && "md:col-span-2")}>
              <div className="flex items-center justify-between gap-2">
                {campo === "status" || campo === "etiquetas" || campo === "ligada_entrega" ? (
                  <span className={rotulo}>{r}</span>
                ) : (
                  <Rotulo htmlFor={`${id}-${campo}`}>{r}</Rotulo>
                )}
                <button
                  type="button"
                  onClick={() => tirar(campo)}
                  className="inline-flex items-center gap-1 rounded-p px-1.5 py-0.5 text-[0.75rem] text-texto-2 hover:bg-superficie-2 hover:text-erro"
                >
                  <X aria-hidden strokeWidth={1.75} className="size-3.5" /> Não mudar
                </button>
              </div>
              <EditorCampo campo={campo} id={`${id}-${campo}`} c={c} mudar={trocar} />
              {(hoje.get(campo) !== undefined || vazioPrazo) && (
                <p className="text-[0.75rem] break-words text-texto-2">
                  {vazioPrazo && "Vazio: a tarefa fica sem prazo. "}
                  {hoje.get(campo) !== undefined && (
                    <>
                      Hoje: <span className="line-clamp-2 inline">{hoje.get(campo)}</span>
                    </>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {fora.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[0.8125rem] text-texto-2">Mudar também:</span>
          {fora.map(({ campo, rotulo: r }) => (
            <button
              key={campo}
              type="button"
              onClick={() => trocar({ ...c, [campo]: valorInicial(campo, p.status === "pendente" ? p.atual : null) })}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-linha px-2.5 text-[0.8125rem] text-texto-2 hover:border-texto-2 hover:text-texto"
            >
              <Plus aria-hidden strokeWidth={2} className="size-3" /> {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ os outros

function EdicaoAtribuicao({ p, d, mudar }: { p: Proposta; d: DadosDe<"atribuir">; mudar: (d: DadosDe<"atribuir">) => void }) {
  const { pessoa } = usePainel();
  const x = pessoa(d.pessoa);
  const nome = x?.apelido ?? x?.nome ?? "Pessoa não encontrada";
  return (
    <div className="flex flex-col gap-2 rounded-m border border-linha p-3">
      <div className="flex items-center gap-2">
        <Avatar pessoa={x} tamanho={28} />
        <span className="min-w-0 flex-1 truncate font-semibold text-texto">{nome}</span>
        <SeletorPapel valor={d.papel} pessoa={nome} hoje={p.papel_atual} mudar={(papel) => mudar(comPapel(d, papel))} />
      </div>
      <div className="pl-9">
        <EditorItens de={nome} itens={d.itens ?? []} mudar={(itens) => mudar({ ...d, itens })} />
      </div>
    </div>
  );
}

function EdicaoItemNovo({ d, mudar }: { d: DadosDe<"adicionar_item">; mudar: (d: DadosDe<"adicionar_item">) => void }) {
  const { ativas } = usePainel();
  const id = useId();
  return (
    <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
      <div className="flex flex-col gap-1">
        <Rotulo htmlFor={`${id}-pessoa`}>De quem</Rotulo>
        <select id={`${id}-pessoa`} value={d.pessoa} onChange={(e) => mudar({ ...d, pessoa: e.target.value })} className={controle}>
          {!ativas.some((p) => p.id === d.pessoa) && <option value={d.pessoa}>Pessoa não encontrada</option>}
          {ativas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.apelido ?? p.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Rotulo htmlFor={`${id}-texto`}>Item</Rotulo>
        <input id={`${id}-texto`} autoFocus value={d.texto} maxLength={500} onChange={(e) => mudar({ ...d, texto: e.target.value })} className={controle} />
      </div>
    </div>
  );
}

function EdicaoItem({ p, d, mudar }: { p: Proposta; d: DadosDe<"atualizar_item">; mudar: (d: DadosDe<"atualizar_item">) => void }) {
  const id = useId();
  const feito = d.feito === undefined ? "" : d.feito ? "sim" : "nao";
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
      <div className="flex flex-col gap-1">
        <Rotulo htmlFor={`${id}-texto`}>Texto do item</Rotulo>
        <input
          id={`${id}-texto`}
          autoFocus
          value={d.texto ?? p.item_texto ?? ""}
          maxLength={500}
          onChange={(e) => mudar({ ...d, texto: e.target.value })}
          className={controle}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Rotulo htmlFor={`${id}-feito`}>Marcação</Rotulo>
        <select
          id={`${id}-feito`}
          value={feito}
          onChange={(e) => mudar(e.target.value ? { ...d, feito: e.target.value === "sim" } : sem(d, "feito"))}
          className={controle}
        >
          <option value="">não muda</option>
          <option value="sim">marcar como feito</option>
          <option value="nao">desmarcar</option>
        </select>
      </div>
    </div>
  );
}

function EdicaoComentario({ d, mudar }: { d: DadosDe<"comentar">; mudar: (d: DadosDe<"comentar">) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Rotulo htmlFor={`${id}-texto`}>Comentário do Claude</Rotulo>
      <textarea
        id={`${id}-texto`}
        autoFocus
        value={d.texto}
        rows={5}
        maxLength={5000}
        onChange={(e) => mudar({ ...d, texto: e.target.value })}
        className={cn(estiloControle, "resize-y py-2 text-[0.9375rem] leading-relaxed")}
      />
    </div>
  );
}

export function EdicaoProposta({ proposta: p, pedido, mudar }: { proposta: Proposta; pedido: Pedido; mudar: (p: Pedido) => void }) {
  switch (pedido.operacao) {
    case "criar_tarefa":
      return <EdicaoTarefaNova d={pedido.dados} mudar={(dados) => mudar({ operacao: "criar_tarefa", dados })} />;
    case "atualizar_tarefa":
      return <EdicaoAlteracao p={p} d={pedido.dados} mudar={(dados) => mudar({ operacao: "atualizar_tarefa", dados })} />;
    case "atribuir":
      return <EdicaoAtribuicao p={p} d={pedido.dados} mudar={(dados) => mudar({ operacao: "atribuir", dados })} />;
    case "adicionar_item":
      return <EdicaoItemNovo d={pedido.dados} mudar={(dados) => mudar({ operacao: "adicionar_item", dados })} />;
    case "atualizar_item":
      return <EdicaoItem p={p} d={pedido.dados} mudar={(dados) => mudar({ operacao: "atualizar_item", dados })} />;
    case "adicionar_documento":
      return (
        <div className="rounded-m border border-linha p-3">
          <CamposDocumento d={pedido.dados} mudar={(d) => mudar({ operacao: "adicionar_documento", dados: { ...pedido.dados, ...d } })} />
        </div>
      );
    case "comentar":
      return <EdicaoComentario d={pedido.dados} mudar={(dados) => mudar({ operacao: "comentar", dados })} />;
    case "remover_atribuicao":
      return null;
  }
}
