"use client";

import { ArrowDown } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// O painel da colhedora anda com a rolagem da página. O bloco gruda abaixo do
// cabeçalho por pouco mais de uma tela e, nesse tempo, passa por quatro etapas:
//   0  a colhedora trabalhando;
//   1  o MoCCa encaixa por cima da esteira e a câmera chega perto dele;
//   2  a câmera se afasta até o mapa da fazenda, e a colhedora anda pela lavoura
//      pintando a produção (o quanto já andou é `avanco`, de 0 a 1);
//   3  o mapa de produção pronto.
// As regras de cada etapa estão no globals.css (.painel-rolagem). Se o bloco não
// cabe na tela, ou com movimento reduzido, nada gruda: a cena e o mapa pronto
// aparecem um embaixo do outro. Sem JavaScript também (o <noscript> do painel).

const ETAPAS = ["Role a página", "Mede na colhedora", "Localiza cada medida", "Mostra no mapa"];

// em telas de rolagem, contadas a partir do ponto em que o bloco gruda
const CHEGA_PERTO = -0.3;
const AFASTA = 0.3;
const PINTA = [0.42, 1.05];

type Estado = { etapa: number; solto: boolean; topo: number; avanco: number };
const Etapa = createContext<Estado>({
  etapa: 0,
  solto: false,
  topo: 104,
  avanco: 0,
});

export const useEtapaDoPainel = () => useContext(Etapa);

export function RolagemDoPainel({ children }: { children: ReactNode }) {
  const trilho = useRef<HTMLDivElement>(null);
  const fixo = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<Estado>({
    etapa: 0,
    solto: false,
    topo: 104,
    avanco: 0,
  });

  useEffect(() => {
    const reduzido = matchMedia("(prefers-reduced-motion: reduce)");

    // a conta é leve (duas medidas): roda a cada evento de rolagem, sem esperar o quadro
    const medir = () => {
      if (!trilho.current || !fixo.current) return;
      const tela = window.innerHeight;
      const cabecalho = document.querySelector("header")?.offsetHeight ?? 88;
      // só o quadro conta: solto, o bloco leva também o mapa embaixo dele
      const quadro = (fixo.current.firstElementChild as HTMLElement | null) ?? fixo.current;
      const sobra = tela - cabecalho - quadro.offsetHeight;
      const solto = reduzido.matches || sobra < 24;
      // o bloco para abaixo do cabeçalho, com uma folga que cresce se a tela for alta
      const topo = Math.round(cabecalho + Math.min(120, Math.max(12, sobra * 0.3)));
      const andou = (topo - trilho.current.getBoundingClientRect().top) / tela;
      const avanco = solto
        ? 1
        : Math.round(Math.min(1, Math.max(0, (andou - PINTA[0]) / (PINTA[1] - PINTA[0]))) * 400) / 400;
      const etapa = solto
        ? 3
        : window.scrollY < 24
          ? 0
          : andou > AFASTA
            ? avanco >= 1
              ? 3
              : 2
            : andou > CHEGA_PERTO
              ? 1
              : 0;
      setEstado((a) =>
        a.etapa === etapa && a.solto === solto && a.topo === topo && a.avanco === avanco
          ? a
          : { etapa, solto, topo, avanco },
      );
    };
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    reduzido.addEventListener("change", medir);
    return () => {
      window.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      reduzido.removeEventListener("change", medir);
    };
  }, []);

  return (
    <Etapa.Provider value={estado}>
      <div ref={trilho} className="painel-rolagem" data-etapa={estado.etapa} data-solto={estado.solto ? "" : undefined}>
        <div ref={fixo} className="sticky" style={{ top: estado.topo }}>
          {children}
        </div>
      </div>
    </Etapa.Provider>
  );
}

// Selo com a etapa da vez, por cima do painel. Some quando o painel não gruda.
export function RotuloDaEtapa({ className }: { className?: string }) {
  const { etapa, solto } = useEtapaDoPainel();
  if (solto) return null;
  return (
    <p
      aria-hidden
      className={cn(
        "t-rotulo pointer-events-none flex items-center gap-2 rounded-full border border-linha bg-superficie/95 px-3 py-1.5 whitespace-nowrap text-texto shadow-cartao",
        className,
      )}
    >
      {etapa === 0 ? (
        <ArrowDown aria-hidden strokeWidth={2} className="size-3.5 text-link" />
      ) : (
        <span className="text-link">0{etapa}</span>
      )}
      {ETAPAS[etapa]}
    </p>
  );
}
