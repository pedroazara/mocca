"use client";

import { useState } from "react";
import { Botao } from "@/components/ui/botao";
import { supabaseNavegador } from "@/lib/supabase/navegador";

// Login com Google pelo Supabase Auth (seção 7.1).
export function BotaoGoogle({ volta }: { volta: string }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setCarregando(true);
    setErro(null);
    const destino = `${window.location.origin}/auth/callback?volta=${encodeURIComponent(volta)}`;
    const { error } = await supabaseNavegador().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: destino },
    });
    if (error) {
      setErro("Não conseguimos abrir o login do Google. Tente de novo.");
      setCarregando(false);
    }
  }

  return (
    <div>
      <Botao onClick={entrar} disabled={carregando} className="w-full">
        <svg aria-hidden viewBox="0 0 24 24" className="size-[18px] fill-current">
          <path d="M21.35 11.1H12v2.98h5.35c-.23 1.46-1.68 4.28-5.35 4.28-3.22 0-5.85-2.67-5.85-5.96S8.78 6.44 12 6.44c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.9 14.55 3 12 3 7.03 3 3 7.03 3 12s4.03 9 9 9c5.2 0 8.64-3.65 8.64-8.8 0-.59-.06-1.04-.14-1.49z" />
        </svg>
        {carregando ? "Abrindo o Google…" : "Entrar com Google"}
      </Botao>
      {erro && <p className="t-pequeno mt-3 text-erro">{erro}</p>}
    </div>
  );
}
