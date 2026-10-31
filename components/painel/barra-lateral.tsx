"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  CalendarRange,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  ExternalLink,
  Flag,
  Inbox,
  LogOut,
  MessagesSquare,
  Monitor,
  Moon,
  MoreHorizontal,
  Settings,
  Sun,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { sair } from "@/app/entrar/acoes";
import { CurvasDeNivel } from "@/components/publico/curvas-de-nivel";
import { LogoHorizontal, Pin } from "@/components/publico/logo";
import { aplicarTema, CHAVE_TEMA, type Tema } from "@/lib/tema";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { Avatar } from "./elementos";

// Barra lateral do painel (seção 8.1). No celular vira gaveta, e uma barra
// inferior fixa mostra Semana, Minhas tarefas, Quadro e Mais.

const CHAVE_RECOLHIDA = "mocca-barra-recolhida";
export const EVENTO_ABRIR_MENU = "mocca:abrir-menu";

type ItemNav = { href: string; rotulo: string; Icone: typeof CalendarRange; contador?: number; exato?: boolean };

function useItens(contadores: { minhas: number; contatos: number }): ItemNav[] {
  return [
    { href: "/painel", rotulo: "Semana", Icone: CalendarRange, exato: true },
    { href: "/painel/minhas-tarefas", rotulo: "Minhas tarefas", Icone: UserCheck, contador: contadores.minhas },
    { href: "/painel/quadro", rotulo: "Quadro", Icone: Columns3 },
    { href: "/painel/semanas", rotulo: "Semanas do programa", Icone: Flag },
    { href: "/painel/reunioes", rotulo: "Reuniões", Icone: MessagesSquare },
    { href: "/painel/contatos", rotulo: "Contatos", Icone: Inbox, contador: contadores.contatos },
    { href: "/painel/equipe", rotulo: "Equipe", Icone: Users },
  ];
}

function ativo(caminho: string, item: { href: string; exato?: boolean }) {
  return item.exato ? caminho === item.href || caminho.startsWith("/painel/tarefas") : caminho.startsWith(item.href);
}

function Lista({
  itens,
  recolhida,
  aoNavegar,
}: {
  itens: ItemNav[];
  recolhida: boolean;
  aoNavegar?: () => void;
}) {
  const caminho = usePathname();
  return (
    <ul className="flex flex-col gap-0.5">
      {itens.map((item) => {
        const atual = ativo(caminho, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={aoNavegar}
              aria-current={atual ? "page" : undefined}
              title={recolhida ? item.rotulo : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-m px-3 text-[0.9375rem] transition-colors duration-150 ease-out",
                atual ? "bg-superficie-2 font-semibold text-texto" : "text-texto-2 hover:bg-superficie-2 hover:text-texto",
                recolhida && "justify-center px-0",
              )}
            >
              <item.Icone aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0" />
              {!recolhida && <span className="flex-1 truncate">{item.rotulo}</span>}
              {!recolhida && Boolean(item.contador) && (
                <span className="t-dado rounded-full bg-superficie-2 px-2 text-[0.75rem] text-texto-2 [[aria-current=page]_&]:bg-fundo">
                  {item.contador}
                </span>
              )}
              {recolhida && Boolean(item.contador) && <span className="sr-only">({item.contador})</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function MenuUsuario({ recolhida }: { recolhida: boolean }) {
  const { eu, pessoa } = usePainel();
  const [tema, setTema] = useState<Tema>("sistema");
  useEffect(() => {
    try {
      const t = localStorage.getItem(CHAVE_TEMA);
      setTema(t === "claro" || t === "escuro" ? t : "sistema");
    } catch {}
  }, []);
  const escolher = (t: Tema) => {
    aplicarTema(t);
    setTema(t);
  };
  const p = pessoa(eu.id);
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "flex w-full items-center gap-3 rounded-m p-2 text-left transition-colors duration-150 ease-out hover:bg-superficie-2",
          recolhida && "justify-center",
        )}
        aria-label="Menu da conta"
      >
        <Avatar pessoa={p} tamanho={28} titulo={false} />
        {!recolhida && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.875rem] font-semibold text-texto">{eu.nome}</span>
            <span className="t-rotulo block text-[0.6875rem] text-texto-2">{eu.papel}</span>
          </span>
        )}
        {!recolhida && <MoreHorizontal aria-hidden strokeWidth={1.75} className="size-4 text-texto-2" />}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          side="top"
          align="start"
          sideOffset={6}
          className="z-50 min-w-56 rounded-m border border-linha bg-superficie p-1.5 shadow-flutuante"
        >
          <Menu.Label className="t-rotulo px-2 py-1.5 text-texto-2">Tema</Menu.Label>
          <Menu.RadioGroup value={tema} onValueChange={(v) => escolher(v as Tema)}>
            {(
              [
                ["claro", "Claro", Sun],
                ["escuro", "Escuro", Moon],
                ["sistema", "Sistema", Monitor],
              ] as const
            ).map(([v, r, I]) => (
              <Menu.RadioItem
                key={v}
                value={v}
                className="flex h-9 cursor-pointer items-center gap-2.5 rounded-p px-2 text-[0.9375rem] text-texto outline-none data-[highlighted]:bg-superficie-2 data-[state=checked]:font-semibold"
              >
                <I aria-hidden strokeWidth={1.75} className="size-4 text-texto-2" />
                {r}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
          <Menu.Separator className="my-1 h-px bg-linha" />
          <Menu.Item asChild>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center gap-2.5 rounded-p px-2 text-[0.9375rem] text-texto outline-none data-[highlighted]:bg-superficie-2"
            >
              <ExternalLink aria-hidden strokeWidth={1.75} className="size-4 text-texto-2" />
              Ver o site
            </a>
          </Menu.Item>
          <Menu.Item
            onSelect={() => sair()}
            className="flex h-9 cursor-pointer items-center gap-2.5 rounded-p px-2 text-[0.9375rem] text-texto outline-none data-[highlighted]:bg-superficie-2"
          >
            <LogOut aria-hidden strokeWidth={1.75} className="size-4 text-texto-2" />
            Sair
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function BarraLateral({ contadores }: { contadores: { minhas: number; contatos: number } }) {
  const { ehAdmin } = usePainel();
  const itens = useItens(contadores);
  const config: ItemNav = { href: "/painel/configuracoes", rotulo: "Configurações", Icone: Settings };
  const [recolhida, setRecolhida] = useState(false);
  const [gaveta, setGaveta] = useState(false);
  const caminho = usePathname();

  useEffect(() => {
    try {
      setRecolhida(localStorage.getItem(CHAVE_RECOLHIDA) === "1");
    } catch {}
    const abrir = () => setGaveta(true);
    window.addEventListener(EVENTO_ABRIR_MENU, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_MENU, abrir);
  }, []);

  const alternar = () => {
    setRecolhida((r) => {
      try {
        localStorage.setItem(CHAVE_RECOLHIDA, r ? "0" : "1");
      } catch {}
      return !r;
    });
  };

  const conteudo = (r: boolean, aoNavegar?: () => void) => (
    <>
      {/* as curvas ficam no espaço livre abaixo do menu, sem passar pelos itens */}
      <div className="relative isolate min-h-0 flex-1 overflow-hidden">
        {!r && (
          <CurvasDeNivel
            conjunto="cartao"
            className="absolute inset-x-0 bottom-0 -z-10 h-56 w-full text-caramelo/25 [mask-image:linear-gradient(to_top,black,transparent)]"
          />
        )}
        <nav aria-label="Painel" className="h-full overflow-y-auto px-3 py-2">
          <Lista itens={itens} recolhida={r} aoNavegar={aoNavegar} />
        </nav>
      </div>
      <div className="flex flex-col gap-1 border-t border-linha px-3 py-3">
        {ehAdmin && <Lista itens={[config]} recolhida={r} aoNavegar={aoNavegar} />}
        <MenuUsuario recolhida={r} />
      </div>
    </>
  );

  const barraInferior = [itens[0], itens[1], itens[2]];

  return (
    <>
      {/* desktop */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-linha bg-superficie transition-[width] duration-200 ease-out lg:flex",
          recolhida ? "w-16" : "w-[248px]",
        )}
      >
        <div className={cn("flex h-14 items-center", recolhida ? "justify-center" : "justify-between pr-2 pl-3")}>
          <Link href="/painel" aria-label="MoCCa, início do painel" className="rounded-m">
            {recolhida ? <Pin tamanho={26} /> : <LogoHorizontal altura={48} className="-ml-2" />}
          </Link>
          {!recolhida && (
            <button
              type="button"
              onClick={alternar}
              aria-label="Recolher a barra lateral"
              className="rounded-p p-1.5 text-texto-2 hover:bg-superficie-2 hover:text-texto"
            >
              <ChevronsLeft aria-hidden strokeWidth={1.75} className="size-[18px]" />
            </button>
          )}
        </div>
        {recolhida && (
          <button
            type="button"
            onClick={alternar}
            aria-label="Abrir a barra lateral"
            className="mx-auto mb-1 rounded-p p-1.5 text-texto-2 hover:bg-superficie-2 hover:text-texto"
          >
            <ChevronsRight aria-hidden strokeWidth={1.75} className="size-[18px]" />
          </button>
        )}
        {conteudo(recolhida)}
      </aside>

      {/* celular: gaveta */}
      <Dialog.Root open={gaveta} onOpenChange={setGaveta}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-texto/30 lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-superficie shadow-flutuante data-[state=open]:animate-[menu-entra_200ms_ease-out] lg:hidden"
          >
            <Dialog.Title className="sr-only">Menu do painel</Dialog.Title>
            <div className="flex h-14 items-center justify-between pr-2 pl-3">
              <LogoHorizontal altura={44} className="-ml-2" />
              <Dialog.Close
                aria-label="Fechar menu"
                className="rounded-p p-2.5 text-texto-2 hover:bg-superficie-2 hover:text-texto"
              >
                <X aria-hidden strokeWidth={1.75} className="size-5" />
              </Dialog.Close>
            </div>
            {conteudo(false, () => setGaveta(false))}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* celular: barra inferior */}
      <nav
        aria-label="Atalhos do painel"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-linha bg-superficie pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {barraInferior.map((item) => {
          const atual = ativo(caminho, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={atual ? "page" : undefined}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem]",
                atual ? "font-semibold text-texto" : "text-texto-2",
              )}
            >
              <item.Icone aria-hidden strokeWidth={1.75} className="size-5" />
              {item.rotulo}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setGaveta(true)}
          className="flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] text-texto-2"
        >
          <MoreHorizontal aria-hidden strokeWidth={1.75} className="size-5" />
          Mais
        </button>
      </nav>
    </>
  );
}
