import { ChevronDown, CircleAlert } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

// Campo de texto da seção 5: rótulo sempre visível, erro abaixo com ícone,
// ligado ao controle por aria-describedby.

export const estiloControle =
  "w-full rounded-p border border-linha bg-superficie px-3 text-base text-texto transition-colors duration-150 ease-out placeholder:text-texto-2/70 hover:border-texto-2/60 aria-[invalid=true]:border-erro";

export function Campo({
  id,
  rotulo,
  opcional = false,
  ajuda,
  erro,
  children,
  className,
}: {
  id: string;
  rotulo: string;
  opcional?: boolean;
  ajuda?: string;
  erro?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[0.9375rem] font-semibold text-texto">
        {rotulo}
        {opcional && <span className="ml-1.5 font-normal text-texto-2">(opcional)</span>}
      </label>
      {children}
      {ajuda && !erro && (
        <p id={`${id}-ajuda`} className="t-pequeno text-texto-2">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={`${id}-erro`} className="t-pequeno flex items-start gap-1.5 text-erro">
          <CircleAlert aria-hidden strokeWidth={1.75} className="mt-px size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}

export function CaixaSelecao({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...props} className={cn(estiloControle, "h-10 appearance-none pr-10", className)} />
      <ChevronDown
        aria-hidden
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 right-3 size-[18px] -translate-y-1/2 text-texto-2"
      />
    </div>
  );
}

export function descricaoDoCampo(id: string, erro?: string, ajuda?: string) {
  if (erro) return `${id}-erro`;
  if (ajuda) return `${id}-ajuda`;
  return undefined;
}
