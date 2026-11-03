"use client";

import {
  ChevronRight,
  CircleAlert,
  ClipboardList,
  ExternalLink,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  File as IconeArquivo,
  Folder,
  FolderOpen,
  PenTool,
  Presentation,
  RefreshCw,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { atualizarArquivos } from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { estiloControle } from "@/components/ui/campo";
import {
  buscarNaArvore,
  caminhoAte,
  ehPasta,
  indexar,
  recentes,
  ROTULO_TIPO,
  tamanhoLegivel,
  type ArvoreDrive,
  type EstadoDrive,
  type IndiceDrive,
  type ItemDrive,
  type TipoArquivo,
  type Uso,
} from "@/lib/drive/arvore";
import { dataCurta, dataHora } from "@/lib/painel/datas";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";

// Aba Arquivos: a pasta do projeto no Google Drive. A árvore inteira chega do
// servidor de uma vez, então navegar entre pastas, buscar e ver os recentes
// acontece aqui, sem esperar o servidor. A pasta aberta fica na URL (?pasta=).

const CAMINHO = "/painel/arquivos";
const LIMITE_RECENTES = 30;

const ICONE: Record<TipoArquivo, LucideIcon> = {
  pasta: Folder,
  documento: FileText,
  planilha: FileSpreadsheet,
  apresentacao: Presentation,
  formulario: ClipboardList,
  desenho: PenTool,
  pdf: FileText,
  imagem: FileImage,
  video: FileVideo,
  audio: FileAudio,
  compactado: FileArchive,
  outro: IconeArquivo,
};

type Vista = "pastas" | "recentes";

export function ArquivosDoDrive({ estado, usos }: { estado: EstadoDrive; usos: Record<string, Uso[]> }) {
  if (estado.estado === "sem_config") return <SemPasta falta={estado.falta} conta={estado.conta} />;
  if (estado.estado === "erro") return <ErroDoDrive mensagem={estado.mensagem} detalhe={estado.detalhe} conta={estado.conta} />;
  return <Navegador arvore={estado.arvore} exemplo={estado.estado === "exemplo"} usos={usos} />;
}

// Com uma tarefa aberta na janela, a URL é a da tarefa, mas a tela de trás
// continua nesta pasta (como o item ativo da barra lateral).
function useParamsDaTela() {
  const caminho = usePathname();
  const atual = useSearchParams().toString();
  const [daTela, setDaTela] = useState(atual);
  const naTela = caminho === CAMINHO;
  if (naTela && daTela !== atual) setDaTela(atual);
  return new URLSearchParams(naTela ? atual : daTela);
}

// A pasta continua na URL nos Recentes, para a aba Pastas voltar a ela.
function hrefDe(destino: { pasta?: string; ver?: Vista }) {
  const p = new URLSearchParams();
  if (destino.pasta) p.set("pasta", destino.pasta);
  if (destino.ver === "recentes") p.set("ver", "recentes");
  const busca = p.toString();
  return busca ? `${CAMINHO}?${busca}` : CAMINHO;
}

type Navegacao = {
  indice: IndiceDrive;
  raiz: ArvoreDrive["raiz"];
  usos: Record<string, Uso[]>;
  hrefPasta: (id: string) => string;
  ir: (href: string) => void;
};

// Link de pasta: troca a URL sem ir ao servidor, mas continua um link de
// verdade (abrir em outra aba, copiar o endereço).
function LinkPasta({ href, nav, className, children }: { href: string; nav: Navegacao; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        nav.ir(href);
      }}
    >
      {children}
    </a>
  );
}

function Navegador({ arvore, exemplo, usos }: { arvore: ArvoreDrive; exemplo: boolean; usos: Record<string, Uso[]> }) {
  const params = useParamsDaTela();
  const indice = useMemo(() => indexar(arvore.itens), [arvore.itens]);
  const [termo, setTermo] = useState("");
  const conteudo = useRef<HTMLDivElement>(null);

  const pedida = params.get("pasta");
  const item = pedida ? indice.porId.get(pedida) : undefined;
  const pasta = item && ehPasta(item) ? item : null; // null: a raiz
  const vista: Vista = params.get("ver") === "recentes" ? "recentes" : "pastas";
  const buscando = termo.trim().length > 0;

  const nav: Navegacao = {
    indice,
    raiz: arvore.raiz,
    usos,
    hrefPasta: (id) => hrefDe({ pasta: id === arvore.raiz.id ? undefined : id }),
    ir: (href) => {
      if (href !== window.location.pathname + window.location.search) window.history.pushState(null, "", href);
      setTermo("");
    },
  };

  // ao trocar de pasta ou de vista, a lista volta ao topo e o foco vai para ela
  const chave = `${vista}:${pasta?.id ?? ""}`;
  const anterior = useRef(chave);
  useEffect(() => {
    if (anterior.current === chave) return;
    anterior.current = chave;
    const el = conteudo.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < 72) el.scrollIntoView({ block: "start" });
    el.focus({ preventScroll: true });
  }, [chave]);

  const rotuloConteudo = buscando ? "Resultados da busca" : vista === "recentes" ? "Arquivos recentes" : `Pasta ${pasta?.nome ?? arvore.raiz.nome}`;

  return (
    <div>
      {exemplo && (
        <p className="mb-4 rounded-m bg-info-fundo px-3 py-2 text-[0.875rem] text-info">
          Pasta de exemplo. No modo local, sem as variáveis do Drive, a aba mostra arquivos fictícios (README, “Arquivos do Google Drive”).
        </p>
      )}
      {arvore.incompleta && (
        <p className="mb-4 rounded-m bg-alerta-fundo px-3 py-2 text-[0.875rem] text-alerta">
          A pasta tem itens demais para ler de uma vez: a lista mostra só parte deles. Use o Drive para ver o resto.
        </p>
      )}

      <div className="mb-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div role="tablist" aria-label="Como ver os arquivos" className="flex gap-1 border-b border-linha">
          {(
            [
              ["pastas", "Pastas"],
              ["recentes", "Recentes"],
            ] as const
          ).map(([v, rotulo]) => {
            const selecionada = !buscando && vista === v;
            return (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={selecionada}
                onClick={() => nav.ir(hrefDe({ pasta: pasta?.id, ver: v }))}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-[0.875rem]",
                  selecionada ? "border-caramelo font-semibold text-texto" : "border-transparent text-texto-2 hover:text-texto",
                )}
              >
                {rotulo}
              </button>
            );
          })}
        </div>
        <div className="relative sm:w-72">
          <Search aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-2" />
          <input
            type="search"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && termo) {
                e.stopPropagation();
                setTermo("");
              }
            }}
            placeholder="Buscar em todas as pastas"
            aria-label="Buscar nos arquivos do Drive"
            className={cn(estiloControle, "h-9 pr-9 pl-9 text-[0.9375rem] [&::-webkit-search-cancel-button]:hidden")}
          />
          {termo && (
            <button
              type="button"
              aria-label="Limpar a busca"
              onClick={() => setTermo("")}
              className="absolute top-1/2 right-1 -translate-y-1/2 rounded-p p-1.5 text-texto-2 hover:bg-superficie-2 hover:text-texto"
            >
              <X aria-hidden strokeWidth={1.75} className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div ref={conteudo} tabIndex={-1} aria-label={rotuloConteudo} className="scroll-mt-20 outline-none">
        {buscando ? (
          <Resultados arvore={arvore} termo={termo} nav={nav} />
        ) : vista === "recentes" ? (
          <Recentes arvore={arvore} nav={nav} />
        ) : (
          <ConteudoDaPasta arvore={arvore} pasta={pasta} nav={nav} />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="t-pequeno text-texto-2">{exemplo ? "Pasta de exemplo, sem ligação com o Drive." : `Lida do Drive em ${dataHora(arvore.lidaEm)}.`}</p>
        {!exemplo && <Atualizar />}
      </div>
    </div>
  );
}

function ConteudoDaPasta({ arvore, pasta, nav }: { arvore: ArvoreDrive; pasta: ItemDrive | null; nav: Navegacao }) {
  const trilha = pasta ? caminhoAte(nav.indice, pasta.id) : [];
  const filhos = nav.indice.filhos.get(pasta?.id ?? arvore.raiz.id) ?? [];
  const passos = [{ id: arvore.raiz.id, nome: arvore.raiz.nome }, ...trilha];
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <nav aria-label="Caminho da pasta" className="min-w-0">
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[0.9375rem]">
            {passos.map((p, i) => (
              <li key={p.id} className="flex min-w-0 items-center gap-1">
                {i > 0 && <ChevronRight aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-texto-2" />}
                {i === passos.length - 1 ? (
                  <span aria-current="page" className="min-w-0 truncate font-semibold text-texto">
                    {p.nome}
                  </span>
                ) : (
                  <LinkPasta href={nav.hrefPasta(p.id)} nav={nav} className="min-w-0 truncate text-texto-2 hover:text-texto hover:underline">
                    {p.nome}
                  </LinkPasta>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <Botao asChild variante="secundario" tamanho="painel">
          <a href={pasta?.link ?? arvore.raiz.link} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden />
            Abrir no Drive
          </a>
        </Botao>
      </div>
      {filhos.length ? (
        <ListaItens itens={filhos} nav={nav} />
      ) : (
        <p className="rounded-m border border-dashed border-linha px-6 py-10 text-center text-texto-2">Esta pasta está vazia.</p>
      )}
    </>
  );
}

function Recentes({ arvore, nav }: { arvore: ArvoreDrive; nav: Navegacao }) {
  const lista = recentes(arvore.itens, LIMITE_RECENTES);
  if (!lista.length) return <p className="rounded-m border border-dashed border-linha px-6 py-10 text-center text-texto-2">Nenhum arquivo na pasta ainda.</p>;
  return (
    <>
      <p className="t-pequeno mb-3 text-texto-2">Os arquivos modificados por último, em todas as pastas.</p>
      <ListaItens itens={lista} nav={nav} comLocal />
    </>
  );
}

function Resultados({ arvore, termo, nav }: { arvore: ArvoreDrive; termo: string; nav: Navegacao }) {
  const { itens, total } = useMemo(() => buscarNaArvore(arvore.itens, termo), [arvore.itens, termo]);
  return (
    <>
      <p role="status" className="t-pequeno mb-3 text-texto-2">
        {total === 0
          ? `Nada encontrado para “${termo.trim()}”.`
          : total > itens.length
            ? `${total} resultados em todas as pastas. Mostrando os ${itens.length} primeiros.`
            : `${total} ${total === 1 ? "resultado" : "resultados"} em todas as pastas.`}
      </p>
      {itens.length > 0 && <ListaItens itens={itens} nav={nav} comLocal />}
    </>
  );
}

function ListaItens({ itens, nav, comLocal = false }: { itens: ItemDrive[]; nav: Navegacao; comLocal?: boolean }) {
  return (
    <ul className="flex flex-col divide-y divide-linha rounded-m border border-linha bg-superficie">
      {itens.map((i) => (
        <LinhaItem key={i.id} item={i} nav={nav} comLocal={comLocal} />
      ))}
    </ul>
  );
}

function LinhaItem({ item, nav, comLocal }: { item: ItemDrive; nav: Navegacao; comLocal: boolean }) {
  const Icone = ICONE[item.tipo];
  const pasta = ehPasta(item);
  const n = pasta ? (nav.indice.filhos.get(item.id)?.length ?? 0) : 0;
  const usos = nav.usos[item.id] ?? [];
  const local = comLocal ? caminhoAte(nav.indice, item.pai) : [];
  const detalhes = [
    item.alvo ? `Atalho · ${ROTULO_TIPO[item.tipo].toLowerCase()}` : ROTULO_TIPO[item.tipo],
    pasta ? (n ? `${n} ${n === 1 ? "item" : "itens"}` : "vazia") : null,
    !pasta && item.modificado ? dataCurta(item.modificado) : null,
    !pasta && item.por ? item.por : null,
    item.tamanho ? tamanhoLegivel(item.tamanho) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const nome = "block truncate font-medium text-texto after:absolute after:inset-0 after:content-[''] hover:underline";

  return (
    <li className="relative flex items-start gap-3 px-3 py-2.5 transition-colors duration-150 ease-out hover:bg-superficie-2/60">
      <Icone aria-hidden strokeWidth={1.75} className="mt-0.5 size-[18px] shrink-0 text-caramelo" />
      <div className="min-w-0 flex-1">
        {pasta ? (
          <LinkPasta href={nav.hrefPasta(item.id)} nav={nav} className={nome}>
            {item.nome}
          </LinkPasta>
        ) : (
          <a href={item.link} target="_blank" rel="noreferrer" title={item.nome} className={nome}>
            {item.nome}
            <span className="sr-only"> (abre no Drive)</span>
          </a>
        )}
        <p className="t-dado truncate text-[0.8125rem] text-texto-2">{detalhes}</p>
        {comLocal && (
          <p className="truncate text-[0.8125rem] text-texto-2">
            em{" "}
            <LinkPasta href={nav.hrefPasta(item.pai)} nav={nav} className="relative z-10 hover:text-texto hover:underline">
              {local.length ? local.map((p) => p.nome).join(" / ") : nav.raiz.nome}
            </LinkPasta>
          </p>
        )}
        {usos.length > 0 && (
          <p className="mt-0.5 text-[0.8125rem] text-texto-2">
            No painel:{" "}
            {usos.slice(0, 3).map((u, i) => (
              <Fragment key={u.href}>
                {i > 0 && ", "}
                <Link href={u.href} scroll={!u.href.startsWith("/painel/tarefas/")} className="link relative z-10">
                  {u.rotulo}
                </Link>
              </Fragment>
            ))}
            {usos.length > 3 && ` e mais ${usos.length - 3}`}
          </p>
        )}
      </div>
      {pasta ? (
        <ChevronRight aria-hidden strokeWidth={1.75} className="mt-0.5 size-[18px] shrink-0 text-texto-2" />
      ) : (
        <ExternalLink aria-hidden strokeWidth={1.75} className="mt-1 size-4 shrink-0 text-texto-2" />
      )}
    </li>
  );
}

function Atualizar({ rotulo = "Atualizar", botao = false }: { rotulo?: string; botao?: boolean }) {
  const { avisar } = usePainel();
  const [pendente, iniciar] = useTransition();
  const clicar = () =>
    iniciar(async () => {
      const r = await atualizarArquivos();
      if (!r.ok) avisar(r.erro, { erro: true });
    });
  const icone = <RefreshCw aria-hidden strokeWidth={1.75} className={cn(botao ? "" : "size-3.5", pendente && "animate-spin motion-reduce:animate-none")} />;
  if (botao)
    return (
      <Botao variante="secundario" tamanho="painel" disabled={pendente} onClick={clicar}>
        {icone}
        {pendente ? "Lendo o Drive…" : rotulo}
      </Botao>
    );
  return (
    <button type="button" disabled={pendente} onClick={clicar} className="link inline-flex items-center gap-1.5 text-[0.8125rem] disabled:opacity-60">
      {icone}
      {pendente ? "Lendo o Drive…" : rotulo}
    </button>
  );
}

function SemPasta({ falta, conta }: { falta: string[]; conta?: string }) {
  const { ehAdmin } = usePainel();
  return (
    <section aria-labelledby="sem-pasta" className="flex flex-col items-start gap-3 rounded-g border border-dashed border-linha p-6">
      <FolderOpen aria-hidden strokeWidth={1.75} className="size-6 text-caramelo" />
      <h2 id="sem-pasta" className="font-titulo text-[1.125rem] font-semibold text-texto">
        A pasta do Drive ainda não está ligada ao painel.
      </h2>
      {ehAdmin ? (
        <>
          <ol className="medida list-decimal space-y-1.5 pl-5 text-texto-2">
            <li>No Google Cloud, ative a Google Drive API e crie uma conta de serviço, com uma chave em JSON.</li>
            <li>
              No Drive, compartilhe a pasta do projeto com o e-mail da conta de serviço
              {conta && (
                <>
                  {" "}
                  (<span className="t-dado break-all text-texto">{conta}</span>)
                </>
              )}
              , como leitor.
            </li>
            <li>
              Na Vercel, cadastre <span className="t-dado text-texto">GOOGLE_DRIVE_FOLDER</span> com o link da pasta e{" "}
              <span className="t-dado text-texto">GOOGLE_SERVICE_ACCOUNT_KEY</span> com o conteúdo do JSON, e publique de novo.
            </li>
          </ol>
          {falta.length > 0 && (
            <p className="t-pequeno text-texto-2">
              Falta: <span className="t-dado">{falta.join(", ")}</span>.
            </p>
          )}
          <p className="t-pequeno text-texto-2">O passo a passo está no README, em “Arquivos do Google Drive”.</p>
        </>
      ) : (
        <p className="text-texto-2">Peça para o admin ligar a pasta do projeto. Enquanto isso, os arquivos continuam no Drive, e os links seguem nas tarefas.</p>
      )}
    </section>
  );
}

function ErroDoDrive({ mensagem, detalhe, conta }: { mensagem: string; detalhe?: string; conta?: string }) {
  const { ehAdmin } = usePainel();
  return (
    <section aria-labelledby="erro-drive" className="flex flex-col items-start gap-4 rounded-g border border-erro/40 bg-superficie p-6">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0 text-erro" />
        <div className="min-w-0">
          <h2 id="erro-drive" className="font-semibold text-texto">
            Não deu para ler a pasta do Drive.
          </h2>
          <p className="mt-1 text-texto-2">{mensagem}</p>
          {ehAdmin && conta && (
            <p className="mt-2 text-[0.875rem] text-texto-2">
              Conta de serviço do painel: <span className="t-dado break-all text-texto">{conta}</span>. Ela precisa estar no compartilhamento da
              pasta, como leitor.
            </p>
          )}
          {ehAdmin && detalhe && <p className="t-dado mt-1 text-[0.75rem] break-all text-texto-2">Resposta do Google: {detalhe}</p>}
          {!ehAdmin && <p className="mt-1 text-texto-2">Se continuar, avise o admin.</p>}
        </div>
      </div>
      <Atualizar rotulo="Tentar de novo" botao />
    </section>
  );
}
