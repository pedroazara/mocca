"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Maximize2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Janela central da tarefa, com URL própria (DUVIDAS 4h). No celular ocupa a tela
// inteira. O topo fica parado, com as ações da tarefa sempre à vista, e a janela
// não pula quando o conteúdo muda de altura. Fechar (Esc, X ou clique fora) volta
// para a tela anterior.
export function JanelaTarefa({
  titulo,
  rotulo,
  hrefPagina,
  acoes,
  children,
}: {
  titulo: string;
  rotulo: string;
  hrefPagina: string;
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Dialog.Root open onOpenChange={(aberto) => !aberto && router.back()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-sobreposicao" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-40 flex flex-col bg-fundo shadow-flutuante data-[state=open]:animate-[janela-entra_200ms_ease-out] sm:inset-x-6 sm:top-[4dvh] sm:bottom-auto sm:mx-auto sm:max-h-[92dvh] sm:max-w-[1040px] sm:overflow-hidden sm:rounded-g sm:border sm:border-linha"
        >
          <Dialog.Title className="sr-only">{titulo}</Dialog.Title>
          <div className="flex h-12 shrink-0 items-center gap-1 border-b border-linha pr-3 pl-5 sm:pl-8">
            <p className="t-rotulo min-w-0 flex-1 truncate text-texto-2">{rotulo}</p>
            {acoes}
            <span aria-hidden className="mx-1.5 hidden h-5 w-px bg-linha sm:block" />
            <Link
              href={hrefPagina}
              onClick={(e) => {
                e.preventDefault();
                window.location.href = hrefPagina;
              }}
              aria-label="Abrir em página inteira"
              title="Abrir em página inteira"
              className="hidden rounded-p p-2 text-texto-2 hover:bg-superficie-2 hover:text-texto sm:block"
            >
              <Maximize2 aria-hidden strokeWidth={1.75} className="size-4" />
            </Link>
            <Dialog.Close aria-label="Fechar (Esc)" className="rounded-p p-2 text-texto-2 hover:bg-superficie-2 hover:text-texto">
              <X aria-hidden strokeWidth={1.75} className="size-[18px]" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-10 sm:px-8">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
