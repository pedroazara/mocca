"use client";

import { TelaErro } from "@/components/ui/tela-erro";

// Erro no site ou na tela de entrar.
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center">
      <div className="conteiner py-20">
        <TelaErro erro={error} tentarDeNovo={reset} />
      </div>
    </main>
  );
}
