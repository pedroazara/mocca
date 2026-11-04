"use client";

import { TelaErro } from "@/components/ui/tela-erro";

// Erro numa tela do painel: a barra lateral continua, e o resto vira um aviso
// com "Tentar de novo" no lugar da página genérica do Next.
export default function ErroPainel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-16 pb-24 lg:px-8">
      <TelaErro erro={error} tentarDeNovo={reset} voltar={{ href: "/painel", rotulo: "Ir para a Semana" }} />
    </div>
  );
}
