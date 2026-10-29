"use client";

import { CircleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { Etiqueta, PapelPainel, Pessoa, Semana } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";

// Dados que quase toda tela do painel usa (pessoas, semanas, etiquetas, quem
// está logado) e os avisos (toasts) com "Desfazer" (seção 5).

export type Eu = { id: string; nome: string; papel: PapelPainel; cor: string };

type Aviso = { id: number; texto: string; erro?: boolean; desfazer?: () => void };

type Contexto = {
  eu: Eu;
  pessoas: Pessoa[];
  ativas: Pessoa[];
  semanas: Semana[];
  etiquetas: Etiqueta[];
  semanaAtual: number;
  podeEditar: boolean;
  ehAdmin: boolean;
  pessoa: (id: string | null | undefined) => Pessoa | undefined;
  etiqueta: (id: string) => Etiqueta | undefined;
  avisar: (texto: string, opcoes?: { erro?: boolean; desfazer?: () => void }) => void;
};

const Ctx = createContext<Contexto | null>(null);

export function usePainel() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePainel fora do ProvedorPainel");
  return c;
}

export function ProvedorPainel({
  eu,
  pessoas,
  semanas,
  etiquetas,
  semanaAtual,
  children,
}: {
  eu: Eu;
  pessoas: Pessoa[];
  semanas: Semana[];
  etiquetas: Etiqueta[];
  semanaAtual: number;
  children: React.ReactNode;
}) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const contador = useRef(0);

  const fechar = useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), []);
  const avisar = useCallback<Contexto["avisar"]>(
    (texto, opcoes) => {
      const id = ++contador.current;
      setAvisos((a) => [...a.slice(-2), { id, texto, ...opcoes }]);
      window.setTimeout(() => fechar(id), opcoes?.desfazer ? 6000 : 4000);
    },
    [fechar],
  );

  const valor = useMemo<Contexto>(() => {
    const porId = new Map(pessoas.map((p) => [p.id, p]));
    const etq = new Map(etiquetas.map((e) => [e.id, e]));
    return {
      eu,
      pessoas,
      ativas: pessoas.filter((p) => p.ativo),
      semanas,
      etiquetas,
      semanaAtual,
      podeEditar: eu.papel !== "orientador",
      ehAdmin: eu.papel === "admin",
      pessoa: (id) => (id ? porId.get(id) : undefined),
      etiqueta: (id) => etq.get(id),
      avisar,
    };
  }, [eu, pessoas, semanas, etiquetas, semanaAtual, avisar]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-20 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 lg:bottom-4"
      >
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.erro ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-center gap-3 rounded-m border bg-superficie px-4 py-3 text-[0.9375rem] shadow-flutuante",
              a.erro ? "border-erro/40 text-erro" : "border-linha text-texto",
            )}
          >
            {a.erro && <CircleAlert aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0" />}
            <span className="flex-1">{a.texto}</span>
            {a.desfazer && (
              <button
                type="button"
                onClick={() => {
                  a.desfazer?.();
                  fechar(a.id);
                }}
                className="link font-semibold"
              >
                Desfazer
              </button>
            )}
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => fechar(a.id)}
              className="-mr-1 rounded-p p-1 text-texto-2 hover:bg-superficie-2"
            >
              <X aria-hidden strokeWidth={1.75} className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
