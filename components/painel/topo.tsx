"use client";

import { ChevronRight, Menu, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { EVENTO_ABRIR_MENU } from "./barra-lateral";
import { usePainel } from "./contexto";
import { DialogoNovaTarefa } from "./nova-tarefa";
import { EVENTO_NOVA_TAREFA, EVENTO_PALETA } from "./paleta";

// Barra superior de cada página do painel (seção 8.1): título, migalhas, busca
// (abre a paleta de comandos) e o botão "Nova tarefa" (atalho N).

export function TopoPagina({
  titulo,
  migalhas,
  acoes,
  semanaNovaTarefa,
}: {
  titulo: string;
  migalhas?: { href: string; rotulo: string }[];
  acoes?: React.ReactNode;
  semanaNovaTarefa?: number;
}) {
  const { podeEditar } = usePainel();
  const [nova, setNova] = useState(false);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const abrir = () => setNova(true);
    window.addEventListener(EVENTO_NOVA_TAREFA, abrir);
    return () => window.removeEventListener(EVENTO_NOVA_TAREFA, abrir);
  }, []);

  useEffect(() => {
    if (!podeEditar) return;
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setNova(true);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [podeEditar]);

  return (
    <header className="sticky top-0 z-30 border-b border-linha bg-fundo/90 backdrop-blur-[8px]">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 lg:px-8">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_MENU))}
          aria-label="Abrir menu"
          className="-ml-2 rounded-p p-2.5 text-texto-2 hover:bg-superficie-2 lg:hidden"
        >
          <Menu aria-hidden strokeWidth={1.75} className="size-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {migalhas?.map((m) => (
            <span key={m.href} className="hidden items-center gap-1.5 sm:flex">
              <Link href={m.href} className="truncate text-[0.9375rem] text-texto-2 hover:text-texto">
                {m.rotulo}
              </Link>
              <ChevronRight aria-hidden strokeWidth={1.75} className="size-4 text-texto-2" />
            </span>
          ))}
          <h1 className="truncate font-titulo text-[1.25rem] font-semibold text-texto">{titulo}</h1>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(EVENTO_PALETA))}
          aria-label="Buscar"
          aria-keyshortcuts="Control+K Meta+K"
          className="flex h-10 shrink-0 items-center gap-2 rounded-p p-2.5 text-texto-2 hover:bg-superficie-2 hover:text-texto md:w-56 md:border md:border-linha md:bg-superficie md:px-3"
        >
          <Search aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0" />
          <span className="hidden flex-1 text-left text-[0.9375rem] md:inline">Buscar…</span>
          <kbd className="t-dado hidden rounded-p border border-linha px-1.5 text-[0.6875rem] md:inline">{mac ? "⌘K" : "Ctrl K"}</kbd>
        </button>
        {acoes}
        {podeEditar && (
          <Botao tamanho="painel" onClick={() => setNova(true)} title="Nova tarefa (N)">
            <Plus aria-hidden />
            <span className="hidden sm:inline">Nova tarefa</span>
          </Botao>
        )}
      </div>
      {podeEditar && <DialogoNovaTarefa aberto={nova} aoMudar={setNova} semanaInicial={semanaNovaTarefa} />}
    </header>
  );
}

export function ConteudoPagina({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1400px] px-4 pt-6 pb-24 lg:px-8 lg:pb-12 ${className ?? ""}`}>{children}</div>;
}
