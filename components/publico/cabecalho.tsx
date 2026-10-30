"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { cn } from "@/lib/utils";
import { BotaoTema } from "./botao-tema";
import { CurvasDeNivel } from "./curvas-de-nivel";
import { LogoHorizontal } from "./logo";
import { COORDENADA_LAVRAS, linksPublicos } from "./navegacao";

export function Cabecalho() {
  const caminho = usePathname();
  const [rolou, setRolou] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 8);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-fundo/90 backdrop-blur-[8px] transition-colors duration-200 ease-out",
        rolou ? "border-linha" : "border-transparent",
      )}
    >
      <div className="conteiner flex h-[72px] items-center justify-between gap-6 md:h-[88px]">
        <Link href="/" aria-label="MoCCa, página inicial" className="-ml-3 flex rounded-m md:-ml-4">
          <LogoHorizontal altura={68} prioridade className="md:hidden" />
          <LogoHorizontal altura={84} prioridade className="hidden md:inline-flex" />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {linksPublicos.map((l) => {
            const ativo = caminho === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "rounded-m px-3 py-2 text-[0.9375rem] font-medium transition-colors duration-150 ease-out hover:bg-superficie-2 hover:text-texto",
                  ativo
                    ? "text-texto underline decoration-caramelo decoration-2 underline-offset-[6px]"
                    : "text-texto-2",
                )}
              >
                {l.rotulo}
              </Link>
            );
          })}
          <BotaoTema className="ml-1" />
          <Botao asChild className="ml-3">
            <Link href="/contato">Fale com a equipe</Link>
          </Botao>
        </nav>

        <div className="flex items-center md:hidden">
          <BotaoTema className="text-texto" />
          <Dialog.Root open={aberto} onOpenChange={setAberto}>
            <Dialog.Trigger asChild>
              <Botao variante="fantasma" tamanho="icone" className="-mr-2 text-texto" aria-label="Abrir menu">
                <Menu />
              </Botao>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Content
                className="fixed inset-0 z-50 isolate flex flex-col overflow-hidden bg-fundo data-[state=open]:animate-[menu-entra_200ms_ease-out]"
                aria-describedby={undefined}
              >
                <Dialog.Title className="sr-only">Menu</Dialog.Title>
                <div className="conteiner flex h-[72px] items-center justify-between">
                  <Link href="/" aria-label="MoCCa, página inicial" className="-ml-3 flex rounded-m" onClick={() => setAberto(false)}>
                    <LogoHorizontal altura={68} />
                  </Link>
                  <div className="flex items-center">
                    <BotaoTema className="text-texto" />
                    <Dialog.Close asChild>
                      <Botao variante="fantasma" tamanho="icone" className="-mr-2 text-texto" aria-label="Fechar menu">
                        <X />
                      </Botao>
                    </Dialog.Close>
                  </div>
                </div>
                <nav aria-label="Principal" className="conteiner mt-6 flex flex-col">
                  {[{ href: "/", rotulo: "Início" }, ...linksPublicos].map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setAberto(false)}
                      aria-current={caminho === l.href ? "page" : undefined}
                      className="flex min-h-11 items-center justify-between border-b border-linha py-4 font-titulo text-2xl font-semibold text-texto aria-[current=page]:text-link"
                    >
                      {l.rotulo}
                      <ArrowRight aria-hidden strokeWidth={1.75} className="size-[22px] text-caramelo" />
                    </Link>
                  ))}
                  <Botao asChild className="mt-8 w-full">
                    <Link href="/contato" onClick={() => setAberto(false)}>
                      Fale com a equipe
                    </Link>
                  </Botao>
                </nav>
                <p className="conteiner t-rotulo mt-auto pb-8 text-texto-2">{COORDENADA_LAVRAS} · Lavras, MG</p>
                <CurvasDeNivel
                  conjunto="rodape"
                  className="absolute inset-x-0 bottom-0 -z-10 h-1/2 w-full text-caramelo/25"
                />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
