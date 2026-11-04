"use client";

import { usePathname } from "next/navigation";
import { JanelaTarefa } from "@/components/painel/janela-tarefa";
import { TelaErro } from "@/components/ui/tela-erro";

// Erro ao abrir a tarefa na janela: o aviso fica dentro da janela, e fechar (X,
// Esc ou clique fora) volta para a tela de antes. Sem este arquivo, o erro caía
// no app/painel/error.tsx, fora da janela, embaixo da página inteira.
export default function ErroJanelaTarefa({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname();
  return (
    <JanelaTarefa titulo="Tarefa" rotulo="Tarefa" hrefPagina={caminho}>
      <TelaErro erro={error} tentarDeNovo={reset} voltar={null} className="py-6" />
    </JanelaTarefa>
  );
}
