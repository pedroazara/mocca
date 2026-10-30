"use client";

import { Moon, Sun } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { aplicarTema } from "@/lib/tema";

// Troca para o oposto do tema na tela; sem escolha salva, o site segue o sistema.
// Os ícones trocam só por CSS (.so-claro / .so-escuro), para não piscar ao carregar.
export function BotaoTema({ className }: { className?: string }) {
  function alternar() {
    const raiz = document.documentElement;
    const escuro = raiz.dataset.tema
      ? raiz.dataset.tema === "escuro"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    aplicarTema(escuro ? "claro" : "escuro");
  }

  return (
    <Botao
      type="button"
      variante="fantasma"
      tamanho="icone"
      className={className}
      onClick={alternar}
      aria-label="Alternar entre tema claro e escuro"
      title="Alternar entre tema claro e escuro"
    >
      <Moon aria-hidden className="so-claro" />
      <Sun aria-hidden className="so-escuro" />
    </Botao>
  );
}
