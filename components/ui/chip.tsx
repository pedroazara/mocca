import { cn } from "@/lib/utils";

const estilos = {
  ok: "bg-ok-fundo text-ok",
  info: "bg-info-fundo text-info",
  alerta: "bg-alerta-fundo text-alerta",
  erro: "bg-erro-fundo text-erro",
  neutro: "bg-superficie-2 text-texto-2",
} as const;

export type EstadoChip = keyof typeof estilos;

// Chip de estado: sempre com texto, nunca só cor (seção 13.1).
export function Chip({
  estado = "neutro",
  children,
  className,
}: {
  estado?: EstadoChip;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 font-dado text-[0.75rem] font-medium whitespace-nowrap",
        estilos[estado],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
