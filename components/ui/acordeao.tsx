"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Acordeao = Accordion.Root;

export function ItemAcordeao({
  valor,
  pergunta,
  children,
}: {
  valor: string;
  pergunta: string;
  children: React.ReactNode;
}) {
  return (
    <Accordion.Item value={valor} className="border-b border-linha">
      <Accordion.Header asChild>
        <h3>
          <Accordion.Trigger
            className={cn(
              "group flex w-full items-center justify-between gap-4 py-5 text-left",
              "font-titulo text-[1.125rem] font-semibold leading-snug text-texto",
              "transition-colors duration-150 ease-out hover:text-link",
            )}
          >
            {pergunta}
            <ChevronDown
              aria-hidden
              strokeWidth={1.75}
              className="size-[22px] shrink-0 text-caramelo transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
            />
          </Accordion.Trigger>
        </h3>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden data-[state=closed]:animate-[acordeao-fecha_180ms_ease-out] data-[state=open]:animate-[acordeao-abre_200ms_ease-out]">
        <div className="medida pb-6 text-texto-2">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
