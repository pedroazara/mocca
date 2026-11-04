"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabaseNavegador } from "@/lib/supabase/navegador";

// Mudanças de outras pessoas aparecem sem recarregar (seção 13.3).
// Em produção: Supabase Realtime nas tabelas tarefa, atribuicao, item e proposta,
// e num canal à parte o registro de e-mails (email_enviado), que entrou depois:
// se a publicação dele ainda não existir, só esse canal falha.
// No modo local (sem Supabase): atualiza a cada 15 s enquanto a aba está visível.

export function AoVivo() {
  const router = useRouter();

  useEffect(() => {
    let espera: number | undefined;
    const atualizar = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => router.refresh(), 500);
    };

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const supabase = supabaseNavegador();
      const canal = supabase.channel("painel");
      for (const tabela of ["tarefa", "atribuicao", "item", "proposta"])
        canal.on("postgres_changes", { event: "*", schema: "public", table: tabela }, atualizar);
      canal.subscribe();
      const emails = supabase
        .channel("painel-emails")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "email_enviado" }, atualizar)
        .subscribe();
      return () => {
        window.clearTimeout(espera);
        supabase.removeChannel(canal);
        supabase.removeChannel(emails);
      };
    }

    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15000);
    return () => {
      window.clearInterval(intervalo);
      window.clearTimeout(espera);
    };
  }, [router]);

  return null;
}
