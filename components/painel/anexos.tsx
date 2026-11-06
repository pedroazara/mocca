"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Download, FileText, Paperclip, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { anexarFoto, anexarPdf, legendarAnexo, removerAnexo, type DonoAnexo } from "@/app/painel/acoes";
import { estiloControle } from "@/components/ui/campo";
import { dataHora } from "@/lib/painel/datas";
import { ehImagem, ehPdf, MAX_ANEXOS, MAX_PDF_BYTES, prepararFoto, tamanhoArquivo } from "@/lib/painel/anexos";
import type { Anexo, Semana } from "@/lib/painel/tipos";
import { cn, listaNomes } from "@/lib/utils";
import { usePainel } from "./contexto";

// Fotos e PDFs (DUVIDAS 4p): na seção Documentos da tarefa e no bloco da entrega
// da semana. As peças daqui servem aos dois: o envio (botão ou arrastar), a
// fileira de miniaturas que abre a foto grande e a linha do PDF, que abre no
// leitor do navegador. Admin e membro anexam, legendam e removem; o orientador
// só vê.

const NA_GRADE = 8;

export const urlAnexo = (id: string, mini = false) => `/painel/anexos/${id}${mini ? "?mini" : ""}`;

// ------------------------------------------------------------------ envio

// Manda os arquivos um por vez e, no fim, um aviso só com o que entrou e o que
// ficou de fora (e por quê).
export function useAnexar(dono: DonoAnexo, jaTem: number) {
  const { avisar } = usePainel();
  const [enviando, setEnviando] = useState<{ feitos: number; total: number } | null>(null);

  async function enviar(lista: File[]) {
    if (enviando || !lista.length) return;
    const aceitos = lista.filter((f) => ehPdf(f) || ehImagem(f));
    const outros = lista.filter((f) => !aceitos.includes(f)).map((f) => f.name);
    const grandes = aceitos.filter((f) => ehPdf(f) && f.size > MAX_PDF_BYTES).map((f) => f.name);
    const validos = aceitos.filter((f) => !(ehPdf(f) && f.size > MAX_PDF_BYTES));
    const fila = validos.slice(0, Math.max(0, MAX_ANEXOS - jaTem));
    const ilegiveis: string[] = [];
    const erros = new Set<string>();
    let enviados = 0;
    if (fila.length) setEnviando({ feitos: 0, total: fila.length });
    for (const [i, arquivo] of fila.entries()) {
      try {
        let r;
        if (ehPdf(arquivo)) {
          const dados = new FormData();
          for (const [k, v] of Object.entries(dono)) dados.set(k, v);
          dados.set("arquivo", arquivo);
          r = await anexarPdf(dados);
        } else {
          r = await anexarFoto(dono, await prepararFoto(arquivo));
        }
        if (r.ok) enviados++;
        else erros.add(r.erro);
      } catch {
        ilegiveis.push(arquivo.name);
      }
      setEnviando({ feitos: i + 1, total: fila.length });
    }
    setEnviando(null);
    const umSo = fila.length === 1 && enviados === 1;
    const partes = [
      umSo ? (ehPdf(fila[0]) ? "PDF anexado." : "Foto anexada.") : enviados ? `${enviados} anexos enviados.` : "",
      ilegiveis.length ? `Não deu para abrir ${listaNomes(ilegiveis)}: use foto em JPEG, PNG ou WebP.` : "",
      grandes.length ? `${listaNomes(grandes)} passa de ${tamanhoArquivo(MAX_PDF_BYTES)}: suba no Drive e cole o link.` : "",
      outros.length ? `Ficou de fora ${listaNomes(outros)}: só fotos e PDF.` : "",
      validos.length > fila.length ? `Ficaram de fora ${validos.length - fila.length}: o máximo é ${MAX_ANEXOS} anexos.` : "",
      ...erros,
    ].filter(Boolean);
    avisar(partes.join(" "), { erro: !enviados });
  }

  return { enviar, enviando };
}

export function TextoEnviando({ enviando }: { enviando: { feitos: number; total: number } | null }) {
  if (!enviando) return null;
  return (
    <span role="status" className="t-dado text-[0.8125rem] text-texto-2">
      enviando {Math.min(enviando.feitos + 1, enviando.total)} de {enviando.total}…
    </span>
  );
}

// O botão é um <label> com o campo de arquivo dentro (fora da vista, mas no Tab).
export function CampoArquivos({
  enviar,
  enviando,
  className,
  children,
}: {
  enviar: (lista: File[]) => void;
  enviando: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foco",
        enviando && "pointer-events-none opacity-60",
        className,
      )}
    >
      {children}
      <input
        type="file"
        accept="image/*,application/pdf,.pdf"
        multiple
        disabled={enviando}
        aria-label="Anexar fotos ou PDF"
        className="sr-only"
        onChange={(e) => {
          const lista = [...(e.target.files ?? [])];
          e.target.value = ""; // permite escolher os mesmos arquivos de novo
          enviar(lista);
        }}
      />
    </label>
  );
}

// Área que aceita arquivos arrastados do computador, com o contorno tracejado.
export function AreaDeArquivos({
  ativa,
  enviar,
  className,
  children,
}: {
  ativa: boolean;
  enviar: (lista: File[]) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [arrastando, setArrastando] = useState(false);
  const aceita = (e: React.DragEvent) => ativa && e.dataTransfer.types.includes("Files");
  return (
    <div
      className={cn(className, arrastando && "rounded-m outline-2 outline-offset-4 outline-caramelo outline-dashed")}
      onDragEnter={(e) => aceita(e) && setArrastando(true)}
      onDragOver={(e) => {
        if (!aceita(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false);
      }}
      onDrop={(e) => {
        if (!aceita(e)) return;
        e.preventDefault();
        setArrastando(false);
        enviar([...e.dataTransfer.files]);
      }}
    >
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ fotos

// Fileira de miniaturas (até 8; a oitava vira "+N") que abre a foto grande.
export function Miniaturas({ fotos: todas, contexto }: { fotos: Anexo[]; contexto: string }) {
  const { avisar } = usePainel();
  const [aberta, setAberta] = useState<string | null>(null);
  // removidas aqui somem na hora; se o servidor recusar, voltam
  const [removidas, setRemovidas] = useState<string[]>([]);
  const [, iniciar] = useTransition();
  const fotos = todas.filter((f) => !removidas.includes(f.id));
  const remover = (id: string) => {
    setRemovidas((r) => [...r, id]);
    iniciar(async () => {
      const r = await removerAnexo(id);
      if (r.ok) return avisar("Foto removida.");
      setRemovidas((l) => l.filter((x) => x !== id));
      avisar(r.erro, { erro: true });
    });
  };
  if (!fotos.length) return null;
  const cheia = fotos.length > NA_GRADE;
  const visiveis = cheia ? fotos.slice(0, NA_GRADE - 1) : fotos;
  return (
    <>
      <ul className="flex flex-wrap gap-2" aria-label="Fotos">
        {visiveis.map((f, i) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => setAberta(f.id)}
              aria-label={`Abrir foto ${i + 1}${f.legenda ? `: ${f.legenda}` : ""}`}
              title={f.legenda ?? undefined}
              className="relative block size-[72px] overflow-hidden rounded-m bg-superficie shadow-cartao transition-transform hover:scale-[1.03] sm:size-20"
            >
              <Image src={urlAnexo(f.id, true)} alt="" fill unoptimized className="object-cover" />
            </button>
          </li>
        ))}
        {cheia && (
          <li>
            <button
              type="button"
              onClick={() => setAberta(fotos[NA_GRADE - 1].id)}
              aria-label={`Ver as outras ${fotos.length - visiveis.length} fotos`}
              className="relative flex size-[72px] items-center justify-center overflow-hidden rounded-m bg-superficie font-titulo text-[1.0625rem] font-semibold text-texto shadow-cartao sm:size-20"
            >
              <Image src={urlAnexo(fotos[NA_GRADE - 1].id, true)} alt="" fill unoptimized className="object-cover opacity-35" />
              <span className="relative">+{fotos.length - visiveis.length}</span>
            </button>
          </li>
        )}
      </ul>
      <VisorFotos contexto={contexto} fotos={fotos} aberta={aberta} abrir={setAberta} remover={remover} />
    </>
  );
}

const quemEQuando = (a: Anexo, nome: string | undefined) => [nome, dataHora(a.criado_em)].filter(Boolean).join(" · ");

// A foto grande, com as setas (e as do teclado, e o deslizar no toque) para as
// outras. A miniatura, que já está no cache, aparece enquanto a foto carrega.
function VisorFotos({
  contexto,
  fotos,
  aberta,
  abrir,
  remover: removerFoto,
}: {
  contexto: string;
  fotos: Anexo[];
  aberta: string | null;
  abrir: (id: string | null) => void;
  remover: (id: string) => void;
}) {
  const { podeEditar, pessoa } = usePainel();
  // a confirmação de remover vale só para a foto em que foi pedida
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [toque, setToque] = useState<number | null>(null);
  const i = fotos.findIndex((f) => f.id === aberta);
  const f = i >= 0 ? fotos[i] : null;
  const anterior = i > 0 ? fotos[i - 1] : null;
  const proxima = i >= 0 && i < fotos.length - 1 ? fotos[i + 1] : null;
  const confirmando = Boolean(f) && confirmar === f?.id;
  const quem = pessoa(f?.enviado_por);

  // Sem a foto na lista (removida aqui ou por outra pessoa), o visor fica
  // fechado. Removida, o visor passa para a vizinha.
  const remover = () => {
    if (!f) return;
    if (!confirmando) return setConfirmar(f.id);
    abrir((proxima ?? anterior)?.id ?? null);
    removerFoto(f.id);
  };

  return (
    <Dialog.Root open={Boolean(f)} onOpenChange={(v) => !v && abrir(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-sobreposicao" />
        <Dialog.Content
          aria-describedby={undefined}
          // o Esc na legenda que está sendo mudada só desfaz a mudança
          onEscapeKeyDown={(e) => {
            if ((document.activeElement as HTMLElement | null)?.dataset.mudou) e.preventDefault();
          }}
          onKeyDown={(e) => {
            if ((e.target as HTMLElement).closest("input")) return;
            if (e.key === "ArrowLeft" && anterior) abrir(anterior.id);
            if (e.key === "ArrowRight" && proxima) abrir(proxima.id);
          }}
          className="fixed inset-0 z-50 flex flex-col bg-fundo outline-none shadow-flutuante data-[state=open]:animate-[janela-entra_200ms_ease-out] sm:inset-x-6 sm:top-[4dvh] sm:bottom-[4dvh] sm:mx-auto sm:max-w-[1040px] sm:overflow-hidden sm:rounded-g sm:border sm:border-linha"
        >
          {f && (
            <>
              <Dialog.Title className="sr-only">
                Foto {i + 1} de {fotos.length} · {contexto}
              </Dialog.Title>
              <div className="flex h-12 shrink-0 items-center gap-1 border-b border-linha pr-3 pl-5">
                <p className="t-rotulo min-w-0 flex-1 truncate text-texto-2">
                  {contexto} · foto <span className="t-dado">{i + 1}</span> de <span className="t-dado">{fotos.length}</span>
                </p>
                <a
                  href={urlAnexo(f.id)}
                  download={f.nome}
                  aria-label="Baixar a foto"
                  title="Baixar a foto"
                  className="rounded-p p-2 text-texto-2 hover:bg-superficie-2 hover:text-texto"
                >
                  <Download aria-hidden strokeWidth={1.75} className="size-[18px]" />
                </a>
                {podeEditar && (
                  <button
                    type="button"
                    onClick={remover}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-p p-2 text-[0.875rem] font-semibold",
                      confirmando ? "bg-erro-fundo px-3 text-erro" : "text-texto-2 hover:bg-superficie-2 hover:text-erro",
                    )}
                    aria-label={confirmando ? "Confirmar: remover a foto" : "Remover a foto"}
                    title="Remover a foto"
                  >
                    <Trash2 aria-hidden strokeWidth={1.75} className="size-[18px]" />
                    {confirmando && "Remover mesmo?"}
                  </button>
                )}
                <span aria-hidden className="mx-1.5 h-5 w-px bg-linha" />
                <Dialog.Close aria-label="Fechar (Esc)" className="rounded-p p-2 text-texto-2 hover:bg-superficie-2 hover:text-texto">
                  <X aria-hidden strokeWidth={1.75} className="size-[18px]" />
                </Dialog.Close>
              </div>

              <div
                className="relative min-h-0 flex-1 bg-superficie-2"
                onTouchStart={(e) => setToque(e.touches[0].clientX)}
                onTouchEnd={(e) => {
                  if (toque === null) return;
                  const dx = e.changedTouches[0].clientX - toque;
                  setToque(null);
                  if (dx > 50 && anterior) abrir(anterior.id);
                  if (dx < -50 && proxima) abrir(proxima.id);
                }}
              >
                <Image key={`mini-${f.id}`} src={urlAnexo(f.id, true)} alt="" fill unoptimized className="object-contain" />
                <Image key={f.id} src={urlAnexo(f.id)} alt={f.legenda ?? `Foto ${i + 1}`} fill unoptimized className="object-contain" />
                {anterior && <SetaFoto lado="esquerda" rotulo="Foto anterior" onClick={() => abrir(anterior.id)} />}
                {proxima && <SetaFoto lado="direita" rotulo="Próxima foto" onClick={() => abrir(proxima.id)} />}
              </div>

              <div className="shrink-0 border-t border-linha px-5 py-3">
                {podeEditar ? <Legenda key={f.id} foto={f} /> : f.legenda && <p className="text-texto">{f.legenda}</p>}
                <p className="t-dado mt-1 text-[0.8125rem] text-texto-2">{quemEQuando(f, quem?.apelido ?? quem?.nome)}</p>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SetaFoto({ lado, rotulo, onClick }: { lado: "esquerda" | "direita"; rotulo: string; onClick: () => void }) {
  const Icone = lado === "esquerda" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        "absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-superficie/90 text-texto shadow-flutuante hover:bg-superficie",
        lado === "esquerda" ? "left-3" : "right-3",
      )}
    >
      <Icone aria-hidden strokeWidth={1.75} className="size-5" />
    </button>
  );
}

// Grava ao sair do campo (ou no Enter). O Esc volta ao texto de antes.
function Legenda({ foto }: { foto: Anexo }) {
  const { avisar } = usePainel();
  const [valor, setValor] = useState(foto.legenda ?? "");
  const [, iniciar] = useTransition();
  const mudou = valor.trim() !== (foto.legenda ?? "");
  const gravar = () => {
    if (!mudou) return;
    iniciar(async () => {
      const r = await legendarAnexo(foto.id, valor);
      if (!r.ok) avisar(r.erro, { erro: true });
    });
  };
  return (
    <input
      value={valor}
      maxLength={300}
      onChange={(e) => setValor(e.target.value)}
      onBlur={gravar}
      data-mudou={mudou || undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setValor(foto.legenda ?? "");
      }}
      placeholder="Escreva uma legenda (opcional)"
      aria-label="Legenda da foto"
      className={cn(estiloControle, "h-9 w-full")}
    />
  );
}

// ------------------------------------------------------------------ PDF

// O PDF abre numa aba, no leitor do navegador. Remover pede confirmação, porque
// não tem Desfazer. `naLista`: linha da lista com borda da seção Documentos.
export function LinhaPdf({ pdf, naLista = false }: { pdf: Anexo; naLista?: boolean }) {
  const { podeEditar, pessoa, avisar } = usePainel();
  const [confirmar, setConfirmar] = useState(false);
  // some na hora; se o servidor recusar, volta
  const [removido, setRemovido] = useState(false);
  const [, iniciar] = useTransition();
  const quem = pessoa(pdf.enviado_por);
  const remover = () => {
    if (!confirmar) return setConfirmar(true);
    setRemovido(true);
    iniciar(async () => {
      const r = await removerAnexo(pdf.id);
      if (r.ok) return avisar("PDF removido.");
      setRemovido(false);
      setConfirmar(false);
      avisar(r.erro, { erro: true });
    });
  };
  if (removido) return null;
  return (
    <li className={cn("group flex items-center gap-2.5", naLista ? "gap-3 px-3 py-2" : "rounded-m py-1")} onMouseLeave={() => setConfirmar(false)}>
      <FileText aria-hidden strokeWidth={1.75} className={cn("shrink-0 text-caramelo", naLista ? "size-[18px]" : "size-4")} />
      <div className="min-w-0 flex-1">
        <a href={urlAnexo(pdf.id)} target="_blank" rel="noreferrer" className="block truncate text-[0.9375rem] text-texto hover:underline">
          {pdf.nome}
        </a>
        <p className="t-dado truncate text-[0.75rem] text-texto-2">
          {tamanhoArquivo(pdf.tamanho)} · {quemEQuando(pdf, quem?.apelido ?? quem?.nome)}
        </p>
      </div>
      {naLista && <span className="t-rotulo shrink-0 text-[0.6875rem] text-texto-2">pdf</span>}
      <a
        href={urlAnexo(pdf.id)}
        download={pdf.nome}
        aria-label={`Baixar ${pdf.nome}`}
        title="Baixar"
        className="rounded-p p-1.5 text-texto-2 hover:bg-superficie-2 hover:text-texto"
      >
        <Download aria-hidden strokeWidth={1.75} className="size-4" />
      </a>
      {podeEditar && (
        <button
          type="button"
          onClick={remover}
          onBlur={() => setConfirmar(false)}
          aria-label={confirmar ? `Confirmar: remover ${pdf.nome}` : `Remover ${pdf.nome}`}
          title="Remover"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-p p-1.5 text-[0.8125rem] font-semibold",
            confirmar ? "bg-erro-fundo px-2.5 text-erro" : "text-texto-2 hover:bg-superficie-2 hover:text-erro",
          )}
        >
          <Trash2 aria-hidden strokeWidth={1.75} className="size-4" />
          {confirmar && "Remover mesmo?"}
        </button>
      )}
    </li>
  );
}

// ------------------------------------------------------------------ entrega da semana

// "Fotos e PDFs" no bloco da entrega (tela Semana e página de cada semana).
export function AnexosDaEntrega({ semana, anexos }: { semana: Semana; anexos: Anexo[] }) {
  const { podeEditar } = usePainel();
  const { enviar, enviando } = useAnexar({ semana: semana.id }, anexos.length);
  const fotos = anexos.filter((a) => a.tipo === "foto");
  const pdfs = anexos.filter((a) => a.tipo === "pdf");

  return (
    <AreaDeArquivos ativa={podeEditar} enviar={(l) => void enviar(l)} className="mt-4 border-t border-linha pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2.5 text-[0.875rem] text-texto">
          <Paperclip aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-caramelo" />
          Fotos e PDFs
          {anexos.length > 0 && <span className="t-dado text-texto-2">· {anexos.length}</span>}
          <TextoEnviando enviando={enviando} />
        </p>
        {podeEditar && (
          <CampoArquivos
            enviar={(l) => void enviar(l)}
            enviando={Boolean(enviando)}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-m border border-texto bg-superficie px-3.5 text-[0.9375rem] font-semibold text-texto transition-colors hover:bg-superficie-2"
          >
            <Paperclip aria-hidden strokeWidth={1.75} className="size-[18px]" />
            Anexar
          </CampoArquivos>
        )}
      </div>

      {fotos.length > 0 && (
        <div className="mt-3">
          <Miniaturas fotos={fotos} contexto={`Semana ${semana.numero}`} />
        </div>
      )}

      {pdfs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1" aria-label="PDFs">
          {pdfs.map((p) => (
            <LinhaPdf key={p.id} pdf={p} />
          ))}
        </ul>
      )}

      {anexos.length === 0 && !enviando && (
        <p className="mt-2 text-[0.875rem] text-texto-2">
          {podeEditar ? "Nada anexado ainda. Use o botão ou arraste fotos e PDFs para cá." : "Nada anexado ainda."}
        </p>
      )}
    </AreaDeArquivos>
  );
}
