"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Download, FileText, Paperclip, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { adicionarFotoEntrega, adicionarPdfEntrega, legendarAnexoEntrega, removerAnexoEntrega } from "@/app/painel/acoes";
import { estiloControle } from "@/components/ui/campo";
import { dataHora } from "@/lib/painel/datas";
import { ehImagem, ehPdf, MAX_ANEXOS_POR_ENTREGA, MAX_PDF_BYTES, prepararFoto, tamanhoArquivo } from "@/lib/painel/anexos";
import type { AnexoEntrega, Semana } from "@/lib/painel/tipos";
import { cn, listaNomes } from "@/lib/utils";
import { usePainel } from "./contexto";

// Anexos da entrega da semana (DUVIDAS 4p): fotos do campo, do protótipo ou da
// apresentação, e PDFs. Ficam no bloco da entrega: as fotos numa fileira de
// miniaturas que abre a foto grande, os PDFs numa lista que abre no leitor do
// navegador. Admin e membro anexam (pelo botão ou arrastando para o bloco),
// legendam as fotos e removem; o orientador só vê.

const NA_GRADE = 8;

const url = (id: string, mini = false) => `/painel/anexos/${id}${mini ? "?mini" : ""}`;

export function AnexosDaEntrega({ semana, anexos }: { semana: Semana; anexos: AnexoEntrega[] }) {
  const { podeEditar, avisar } = usePainel();
  const [enviando, setEnviando] = useState<{ feitos: number; total: number } | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const fotos = anexos.filter((a) => a.tipo === "foto");
  const pdfs = anexos.filter((a) => a.tipo === "pdf");

  async function enviar(lista: File[]) {
    if (enviando || !lista.length) return;
    const aceitos = lista.filter((f) => ehPdf(f) || ehImagem(f));
    const outros = lista.filter((f) => !aceitos.includes(f)).map((f) => f.name);
    const grandes = aceitos.filter((f) => ehPdf(f) && f.size > MAX_PDF_BYTES).map((f) => f.name);
    const validos = aceitos.filter((f) => !(ehPdf(f) && f.size > MAX_PDF_BYTES));
    const espaco = Math.max(0, MAX_ANEXOS_POR_ENTREGA - anexos.length);
    const fila = validos.slice(0, espaco);
    const ilegiveis: string[] = [];
    const erros = new Set<string>();
    let enviados = 0;
    if (fila.length) setEnviando({ feitos: 0, total: fila.length });
    for (const [i, arquivo] of fila.entries()) {
      try {
        let r;
        if (ehPdf(arquivo)) {
          const dados = new FormData();
          dados.set("semana", semana.id);
          dados.set("arquivo", arquivo);
          r = await adicionarPdfEntrega(dados);
        } else {
          r = await adicionarFotoEntrega(semana.id, await prepararFoto(arquivo));
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
      validos.length > fila.length
        ? `Ficaram de fora ${validos.length - fila.length}: o máximo é ${MAX_ANEXOS_POR_ENTREGA} anexos por entrega.`
        : "",
      ...erros,
    ].filter(Boolean);
    avisar(partes.join(" "), { erro: !enviados });
  }

  const cheia = fotos.length > NA_GRADE;
  const visiveis = cheia ? fotos.slice(0, NA_GRADE - 1) : fotos;
  const aceitaArquivo = (e: React.DragEvent) => podeEditar && e.dataTransfer.types.includes("Files");

  return (
    <div
      className={cn("mt-4 border-t border-linha pt-4", arrastando && "rounded-m outline-2 outline-offset-4 outline-caramelo outline-dashed")}
      onDragEnter={(e) => aceitaArquivo(e) && setArrastando(true)}
      onDragOver={(e) => {
        if (!aceitaArquivo(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false);
      }}
      onDrop={(e) => {
        if (!aceitaArquivo(e)) return;
        e.preventDefault();
        setArrastando(false);
        void enviar([...e.dataTransfer.files]);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2.5 text-[0.875rem] text-texto">
          <Paperclip aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-caramelo" />
          Fotos e PDFs
          {anexos.length > 0 && <span className="t-dado text-texto-2">· {anexos.length}</span>}
          {enviando && (
            <span role="status" className="t-dado text-texto-2">
              · enviando {Math.min(enviando.feitos + 1, enviando.total)} de {enviando.total}…
            </span>
          )}
        </p>
        {podeEditar && (
          <label
            className={cn(
              "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-m border border-texto bg-superficie px-3.5 text-[0.9375rem] font-semibold text-texto transition-colors hover:bg-superficie-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foco",
              enviando && "pointer-events-none opacity-60",
            )}
          >
            <Paperclip aria-hidden strokeWidth={1.75} className="size-[18px]" />
            Anexar
            <input
              type="file"
              accept="image/*,application/pdf,.pdf"
              multiple
              disabled={Boolean(enviando)}
              aria-label="Anexar fotos ou PDF à entrega"
              className="sr-only"
              onChange={(e) => {
                const lista = [...(e.target.files ?? [])];
                e.target.value = ""; // permite escolher os mesmos arquivos de novo
                void enviar(lista);
              }}
            />
          </label>
        )}
      </div>

      {fotos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Fotos">
          {visiveis.map((f, i) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setAberta(f.id)}
                aria-label={`Abrir foto ${i + 1}${f.legenda ? `: ${f.legenda}` : ""}`}
                title={f.legenda ?? undefined}
                className="relative block size-[72px] overflow-hidden rounded-m bg-superficie shadow-cartao transition-transform hover:scale-[1.03] sm:size-20"
              >
                <Image src={url(f.id, true)} alt="" fill unoptimized className="object-cover" />
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
                <Image src={url(fotos[NA_GRADE - 1].id, true)} alt="" fill unoptimized className="object-cover opacity-35" />
                <span className="relative">+{fotos.length - visiveis.length}</span>
              </button>
            </li>
          )}
        </ul>
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

      <VisorFotos semana={semana} fotos={fotos} aberta={aberta} abrir={setAberta} />
    </div>
  );
}

const quemEQuando = (a: AnexoEntrega, nome: string | undefined) => [nome, dataHora(a.criado_em)].filter(Boolean).join(" · ");

// O PDF abre numa aba, no leitor do navegador. Remover pede confirmação.
function LinhaPdf({ pdf }: { pdf: AnexoEntrega }) {
  const { podeEditar, pessoa, avisar } = usePainel();
  const [confirmar, setConfirmar] = useState(false);
  const [removendo, iniciar] = useTransition();
  const quem = pessoa(pdf.enviado_por);
  const remover = () => {
    if (!confirmar) return setConfirmar(true);
    iniciar(async () => {
      const r = await removerAnexoEntrega(pdf.id);
      if (!r.ok) avisar(r.erro, { erro: true });
      else avisar("PDF removido.");
    });
  };
  return (
    <li className="group flex items-center gap-2.5 rounded-m py-1" onMouseLeave={() => setConfirmar(false)}>
      <FileText aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-caramelo" />
      <div className="min-w-0 flex-1">
        <a href={url(pdf.id)} target="_blank" rel="noreferrer" className="block truncate text-[0.9375rem] text-texto hover:underline">
          {pdf.nome}
        </a>
        <p className="t-dado truncate text-[0.75rem] text-texto-2">
          {tamanhoArquivo(pdf.tamanho)} · {quemEQuando(pdf, quem?.apelido ?? quem?.nome)}
        </p>
      </div>
      <a
        href={url(pdf.id)}
        download={pdf.nome}
        aria-label={`Baixar ${pdf.nome}`}
        title="Baixar"
        className="rounded-p p-1.5 text-texto-2 hover:bg-superficie hover:text-texto"
      >
        <Download aria-hidden strokeWidth={1.75} className="size-4" />
      </a>
      {podeEditar && (
        <button
          type="button"
          onClick={remover}
          onBlur={() => setConfirmar(false)}
          disabled={removendo}
          aria-label={confirmar ? `Confirmar: remover ${pdf.nome}` : `Remover ${pdf.nome}`}
          title="Remover"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-p p-1.5 text-[0.8125rem] font-semibold disabled:opacity-60",
            confirmar ? "bg-erro-fundo px-2.5 text-erro" : "text-texto-2 hover:bg-superficie hover:text-erro",
          )}
        >
          <Trash2 aria-hidden strokeWidth={1.75} className="size-4" />
          {confirmar && "Remover mesmo?"}
        </button>
      )}
    </li>
  );
}

// A foto grande, com as setas (e as do teclado, e o deslizar no toque) para as
// outras. A miniatura, que já está no cache, aparece enquanto a foto carrega.
function VisorFotos({
  semana,
  fotos,
  aberta,
  abrir,
}: {
  semana: Semana;
  fotos: AnexoEntrega[];
  aberta: string | null;
  abrir: (id: string | null) => void;
}) {
  const { podeEditar, pessoa, avisar } = usePainel();
  const [removendo, iniciar] = useTransition();
  // a confirmação de remover vale só para a foto em que foi pedida
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [toque, setToque] = useState<number | null>(null);
  const i = fotos.findIndex((f) => f.id === aberta);
  const f = i >= 0 ? fotos[i] : null;
  const anterior = i > 0 ? fotos[i - 1] : null;
  const proxima = i >= 0 && i < fotos.length - 1 ? fotos[i + 1] : null;
  const confirmando = Boolean(f) && confirmar === f?.id;
  const quem = pessoa(f?.enviado_por);

  // Sem a foto na lista (removida aqui ou por outra pessoa), o visor fica fechado.
  const remover = () => {
    if (!f) return;
    if (!confirmando) return setConfirmar(f.id);
    const seguinte = proxima ?? anterior;
    iniciar(async () => {
      const r = await removerAnexoEntrega(f.id);
      if (!r.ok) return avisar(r.erro, { erro: true });
      avisar("Foto removida.");
      abrir(seguinte?.id ?? null);
    });
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
                Foto {i + 1} de {fotos.length} da entrega da semana {semana.numero}
              </Dialog.Title>
              <div className="flex h-12 shrink-0 items-center gap-1 border-b border-linha pr-3 pl-5">
                <p className="t-rotulo min-w-0 flex-1 truncate text-texto-2">
                  Semana {semana.numero} · foto <span className="t-dado">{i + 1}</span> de <span className="t-dado">{fotos.length}</span>
                </p>
                <a
                  href={url(f.id)}
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
                    disabled={removendo}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-p p-2 text-[0.875rem] font-semibold disabled:opacity-60",
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
                <Image key={`mini-${f.id}`} src={url(f.id, true)} alt="" fill unoptimized className="object-contain" />
                <Image
                  key={f.id}
                  src={url(f.id)}
                  alt={f.legenda ?? `Foto ${i + 1} da entrega da semana ${semana.numero}`}
                  fill
                  unoptimized
                  className="object-contain"
                />
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
function Legenda({ foto }: { foto: AnexoEntrega }) {
  const { avisar } = usePainel();
  const [valor, setValor] = useState(foto.legenda ?? "");
  const [, iniciar] = useTransition();
  const mudou = valor.trim() !== (foto.legenda ?? "");
  const gravar = () => {
    if (!mudou) return;
    iniciar(async () => {
      const r = await legendarAnexoEntrega(foto.id, valor);
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
