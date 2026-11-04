"use client";

import { TelaErro } from "@/components/ui/tela-erro";
import "./globals.css";

// Erro no próprio layout raiz: esta tela substitui o documento inteiro.
export default function ErroGeral({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh items-center">
        <div className="conteiner py-20">
          <TelaErro erro={error} tentarDeNovo={reset} />
        </div>
      </body>
    </html>
  );
}
