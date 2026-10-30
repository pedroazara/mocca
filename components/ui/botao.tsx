import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

// Botões da seção 5. "claro" é a variação para fundos escuros de cor fixa (chamada
// final, "Para quem"): as cores não mudam com o tema, nem no hover.
export const estilosBotao = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-m font-texto font-semibold transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
  {
    variants: {
      variante: {
        primario: "bg-botao-primario text-botao-primario-texto hover:bg-botao-primario-hover",
        secundario: "border border-texto bg-transparent text-texto hover:bg-superficie-2",
        fantasma: "bg-transparent text-texto-2 hover:bg-superficie-2 hover:text-texto",
        claro: "bg-creme text-espresso hover:bg-creme/85",
      },
      tamanho: {
        site: "h-11 px-5 text-base",
        painel: "h-9 px-3.5 text-[0.9375rem]",
        icone: "size-11",
      },
    },
    defaultVariants: { variante: "primario", tamanho: "site" },
  },
);

type PropsBotao = React.ComponentProps<"button"> &
  VariantProps<typeof estilosBotao> & { asChild?: boolean };

export function Botao({ className, variante, tamanho, asChild = false, ...props }: PropsBotao) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(estilosBotao({ variante, tamanho }), className)} {...props} />;
}
