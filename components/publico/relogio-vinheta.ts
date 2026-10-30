"use client";

import { useEffect, useRef, useState } from "react";

// Relógio das vinhetas animadas do passo a passo (em segundos, de 0 a `ciclo`).
// Só anda enquanto a vinheta está na tela e a aba está aberta. O primeiro quadro,
// o mesmo do servidor, é `parado`: o momento que melhor explica o passo. Com
// movimento reduzido, a vinheta fica nele.
export function useRelogioDaVinheta<T extends Element>(ciclo: number, parado: number) {
  const ref = useRef<T>(null);
  const [t, setT] = useState(parado);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduzido = matchMedia("(prefers-reduced-motion: reduce)");
    let tempo = parado;
    let ultimo = 0;
    let pedido = 0;
    let naTela = false;

    const passo = (agora: number) => {
      tempo = (tempo + Math.min(0.05, (agora - ultimo) / 1000)) % ciclo;
      ultimo = agora;
      setT(tempo);
      pedido = requestAnimationFrame(passo);
    };
    const ligar = () => {
      cancelAnimationFrame(pedido);
      if (reduzido.matches) {
        tempo = parado;
        setT(parado);
      } else if (naTela && !document.hidden) {
        ultimo = performance.now();
        pedido = requestAnimationFrame(passo);
      }
    };

    const io = new IntersectionObserver(([e]) => {
      naTela = e.isIntersecting;
      ligar();
    });
    io.observe(el);
    reduzido.addEventListener("change", ligar);
    document.addEventListener("visibilitychange", ligar);

    return () => {
      cancelAnimationFrame(pedido);
      io.disconnect();
      reduzido.removeEventListener("change", ligar);
      document.removeEventListener("visibilitychange", ligar);
    };
  }, [ciclo, parado]);

  return [ref, t] as const;
}
