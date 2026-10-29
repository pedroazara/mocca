"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Maximize2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Painel lateral de 560 px pela direita (tela cheia no celular), com URL
// própria (seção 9.4). Fechar (Esc, X ou clique fora) volta para a tela anterior.
export function PainelLateral({
  titulo,
  hrefPagina,
  children,
}: {
  titulo: string;
  hrefPagina: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Dialog.Root open onOpenChange={(aberto) => !aberto && router.back()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-texto/20" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-linha bg-fundo shadow-flutuante data-[state=open]:animate-[painel-entra_200ms_ease-out] sm:w-[560px]"
        >
          <Dialog.Title className="sr-only">{titulo}</Dialog.Title>
          <div className="flex h-12 shrink-0 items-center justify-end gap-1 border-b border-linha px-3">
            <Link
              href={hrefPagina}
              onClick={(e) => {
                e.preventDefault();
                window.location.href = hrefPagina;
              }}
              aria-label="Abrir em página inteira"
              className="rounded-p p-2 text-texto-2 hover:bg-superficie-2 hover:text-texto"
            >
              <Maximize2 aria-hidden strokeWidth={1.75} className="size-4" />
            </Link>
            <Dialog.Close aria-label="Fechar (Esc)" className="rounded-p p-2 text-texto-2 hover:bg-superficie-2 hover:text-texto">
              <X aria-hidden strokeWidth={1.75} className="size-[18px]" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pt-5 pb-10 sm:px-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
