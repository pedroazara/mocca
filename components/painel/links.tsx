"use client";

import { Copy, FileText, Globe, Pencil, Plus, Search, Trash2, type LucideIcon } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";
import { atualizarLink, criarLink, removerLink, type DadosLink } from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { estiloControle } from "@/components/ui/campo";
import type { LinkEquipe } from "@/lib/painel/tipos";
import { normalizar } from "@/lib/painel/trello";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { iconeDocumento, tituloPelaUrl } from "./detalhe-tarefa";
import { EstadoVazio } from "./elementos";

// Links da equipe (pedido do Pedro, fora da especificação): pastas do Drive,
// portal do Avança Café, formulários, referências. Agrupados por categoria.
// Admin e membros adicionam, editam e removem; o orientador abre e copia.

const GOOGLE = /^https:\/\/(drive|docs)\.google\.com\//;

function comEsquema(url: string) {
  const s = url.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
}

function dominio(url: string) {
  if (!url.trim() || /\s/.test(url.trim())) return "";
  try {
    const host = new URL(comEsquema(url)).hostname.replace(/^www\./, "");
    return host.includes(".") ? host : "";
  } catch {
    return "";
  }
}

// Título sugerido quando a pessoa não digita um: o tipo do arquivo do Drive
// ("Planilha", "Pasta"…) ou o domínio do site.
function sugestaoTitulo(url: string) {
  if (!url.trim()) return "";
  return (GOOGLE.test(comEsquema(url)) && tituloPelaUrl(url)) || dominio(url);
}

function iconeLink(url: string): LucideIcon {
  if (GOOGLE.test(url)) return iconeDocumento(url);
  if (/\.pdf($|[?#])/i.test(url)) return FileText;
  return Globe;
}

type Campos = { url: string; titulo: string; categoria: string; descricao: string };

function FormLink({
  inicial,
  categorias,
  aoSalvar,
  aoCancelar,
}: {
  inicial?: LinkEquipe;
  categorias: string[];
  aoSalvar: (d: DadosLink) => Promise<void>;
  aoCancelar: () => void;
}) {
  const id = useId();
  const [pendente, iniciar] = useTransition();
  const [f, setF] = useState<Campos>({
    url: inicial?.url ?? "",
    titulo: inicial?.titulo ?? "",
    categoria: inicial?.categoria ?? "",
    descricao: inicial?.descricao ?? "",
  });
  const mudar = (k: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const campo = cn(estiloControle, "h-10");
  const rotulo = "text-[0.875rem] font-semibold text-texto";
  const opcional = <span className="font-normal text-texto-2">(opcional)</span>;

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(() => aoSalvar({ ...f, titulo: f.titulo.trim() || sugestaoTitulo(f.url) }));
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          aoCancelar();
        }
      }}
    >
      <label className="grid gap-1 sm:col-span-2">
        <span className={rotulo}>Endereço</span>
        <input
          autoFocus
          required
          className={campo}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://…"
          value={f.url}
          onChange={mudar("url")}
        />
      </label>
      <label className="grid gap-1">
        <span className={rotulo}>Título {opcional}</span>
        <input
          className={campo}
          maxLength={200}
          placeholder={sugestaoTitulo(f.url) || "Ex.: Pasta da equipe"}
          value={f.titulo}
          onChange={mudar("titulo")}
        />
      </label>
      <label className="grid gap-1">
        <span className={rotulo}>Categoria {opcional}</span>
        <input
          className={campo}
          maxLength={60}
          list={`${id}-categorias`}
          placeholder="Ex.: Avança Café"
          value={f.categoria}
          onChange={mudar("categoria")}
        />
        <datalist id={`${id}-categorias`}>
          {categorias.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label className="grid gap-1 sm:col-span-2">
        <span className={rotulo}>Descrição {opcional}</span>
        <input
          className={campo}
          maxLength={500}
          placeholder="Para que serve, em uma linha"
          value={f.descricao}
          onChange={mudar("descricao")}
        />
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Botao type="button" variante="fantasma" tamanho="painel" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" tamanho="painel" disabled={!f.url.trim() || pendente}>
          {inicial ? "Salvar" : "Adicionar"}
        </Botao>
      </div>
    </form>
  );
}

function BotaoIcone({
  rotulo,
  perigo = false,
  onClick,
  children,
}: {
  rotulo: string;
  perigo?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      onClick={onClick}
      className={cn(
        "rounded-p p-2 text-texto-2 hover:bg-superficie-2 [&_svg]:size-4 [&_svg]:stroke-[1.75]",
        perigo ? "hover:text-erro" : "hover:text-texto",
      )}
    >
      {children}
    </button>
  );
}

export function PaginaLinks({ links }: { links: LinkEquipe[] }) {
  const { podeEditar, avisar } = usePainel();
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [, iniciar] = useTransition();

  const categorias = useMemo(
    () => [...new Set(links.map((l) => l.categoria).filter((c): c is string => Boolean(c)))],
    [links],
  );

  // a ordem vem do banco (categoria, sem categoria por último, título)
  const grupos = useMemo(() => {
    const t = normalizar(filtro);
    const m = new Map<string | null, LinkEquipe[]>();
    for (const l of links) {
      if (t && ![l.titulo, l.descricao, l.categoria, l.url].some((x) => x && normalizar(x).includes(t))) continue;
      m.set(l.categoria, [...(m.get(l.categoria) ?? []), l]);
    }
    return [...m.entries()];
  }, [links, filtro]);

  const criar = async (d: DadosLink) => {
    const r = await criarLink(d);
    if (!r.ok) return avisar(r.erro, { erro: true });
    avisar("Link adicionado.");
    setNovo(false);
  };

  const salvar = (id: string) => async (d: DadosLink) => {
    const r = await atualizarLink(id, d);
    if (!r.ok) return avisar(r.erro, { erro: true });
    avisar("Link atualizado.");
    setEditando(null);
  };

  const remover = (l: LinkEquipe) =>
    iniciar(async () => {
      const r = await removerLink(l.id);
      if (!r.ok) return avisar(r.erro, { erro: true });
      avisar(`"${l.titulo}" removido.`, {
        desfazer: () => void criarLink({ titulo: l.titulo, url: l.url, descricao: l.descricao, categoria: l.categoria }),
      });
    });

  const copiar = async (l: LinkEquipe) => {
    try {
      await navigator.clipboard.writeText(l.url);
      avisar("Link copiado.");
    } catch {
      avisar("Não deu para copiar o link.", { erro: true });
    }
  };

  const abrirNovo = () => {
    setEditando(null);
    setNovo(true);
  };

  const formNovo = novo && (
    <section aria-labelledby="novo-link" className="rounded-g border border-linha bg-superficie p-5">
      <h2 id="novo-link" className="t-rotulo mb-4 text-texto-2">
        Novo link
      </h2>
      <FormLink categorias={categorias} aoSalvar={criar} aoCancelar={() => setNovo(false)} />
    </section>
  );

  if (!links.length)
    return (
      formNovo || (
        <EstadoVazio
          texto="Nenhum link ainda. Guarde aqui o portal do Avança Café, formulários, referências e o que mais a equipe abre sempre."
          acao={
            podeEditar ? (
              <Botao tamanho="painel" onClick={abrirNovo}>
                <Plus aria-hidden /> Adicionar link
              </Botao>
            ) : undefined
          }
        />
      )
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Filtrar links</span>
          <Search
            aria-hidden
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-texto-2"
          />
          <input
            type="search"
            className={cn(estiloControle, "h-10 pl-10")}
            placeholder="Filtrar links"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </label>
        {podeEditar && !novo && (
          <Botao tamanho="painel" className="h-10" onClick={abrirNovo}>
            <Plus aria-hidden />
            <span className="hidden sm:inline">Adicionar link</span>
            <span className="sm:hidden">Adicionar</span>
          </Botao>
        )}
      </div>

      {formNovo}

      {grupos.length === 0 && <p className="text-texto-2">Nenhum link com “{filtro.trim()}”.</p>}

      {grupos.map(([categoria, lista]) => (
        <section key={categoria ?? ""} aria-label={categoria ?? "Outros links"}>
          {(categoria || grupos.length > 1) && (
            <h2 className="t-rotulo mb-2 flex items-center gap-2 text-texto-2">
              {categoria ?? "Outros"}
              <span className="t-dado">{lista.length}</span>
            </h2>
          )}
          <ul className="divide-y divide-linha rounded-g border border-linha bg-superficie">
            {lista.map((l) => {
              if (editando === l.id)
                return (
                  <li key={l.id} className="p-4">
                    <FormLink inicial={l} categorias={categorias} aoSalvar={salvar(l.id)} aoCancelar={() => setEditando(null)} />
                  </li>
                );
              const Icone = iconeLink(l.url);
              return (
                <li key={l.id} className="group flex items-start gap-3 py-2.5 pr-2 pl-4">
                  <Icone aria-hidden strokeWidth={1.75} className="mt-[3px] size-[18px] shrink-0 text-caramelo" />
                  <div className="min-w-0 flex-1 py-px">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 font-semibold break-words text-texto underline-offset-[3px] hover:underline"
                      >
                        {l.titulo}
                      </a>
                      {dominio(l.url) !== l.titulo && (
                        <span className="t-dado max-w-full truncate text-[0.75rem] text-texto-2">{dominio(l.url)}</span>
                      )}
                    </div>
                    {l.descricao && <p className="mt-0.5 text-[0.875rem] text-texto-2">{l.descricao}</p>}
                  </div>
                  <div className="flex shrink-0 items-center lg:opacity-0 lg:transition-opacity lg:duration-150 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                    <BotaoIcone rotulo={`Copiar o endereço de ${l.titulo}`} onClick={() => void copiar(l)}>
                      <Copy aria-hidden />
                    </BotaoIcone>
                    {podeEditar && (
                      <>
                        <BotaoIcone
                          rotulo={`Editar ${l.titulo}`}
                          onClick={() => {
                            setNovo(false);
                            setEditando(l.id);
                          }}
                        >
                          <Pencil aria-hidden />
                        </BotaoIcone>
                        <BotaoIcone rotulo={`Remover ${l.titulo}`} perigo onClick={() => remover(l)}>
                          <Trash2 aria-hidden />
                        </BotaoIcone>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
