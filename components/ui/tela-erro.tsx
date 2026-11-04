"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";
import { Botao } from "@/components/ui/botao";

// Tela de erro no estilo do site: diz o que houve em português, oferece tentar
// de novo e mostra um código curto para a equipe procurar no log da Vercel.
// O "voltar" carrega a página inteira: a navegação do Next não tira o erro da
// tela quando o caminho é o mesmo (a Semana que falhou e o "Ir para a Semana").
// Na janela da tarefa, ele fica de fora (voltar={null}): fechar já volta.
export function TelaErro({
  erro,
  tentarDeNovo,
  voltar = { href: "/", rotulo: "Voltar para o início" },
  className,
}: {
  erro: Error & { digest?: string };
  tentarDeNovo: () => void;
  voltar?: { href: string; rotulo: string } | null;
  className?: string;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error(erro);
  }, [erro]);
  // o erro veio do servidor: buscar a tela de novo antes de redesenhar
  const tentar = () =>
    startTransition(() => {
      router.refresh();
      tentarDeNovo();
    });
  return (
    <div role="alert" className={className}>
      <p className="t-rotulo text-texto-2">Algo deu errado</p>
      <h1 className="t-h2 mt-3 max-w-[22ch] text-texto">Não conseguimos abrir esta tela agora.</h1>
      <p className="medida mt-3 text-texto-2">
        Pode ser uma falha passageira na conexão com o servidor. Tente de novo; se continuar, avise a equipe com o código abaixo.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Botao tamanho="painel" onClick={tentar}>
          <RotateCcw aria-hidden />
          Tentar de novo
        </Botao>
        {voltar && (
          <Botao asChild variante="secundario" tamanho="painel">
            <a href={voltar.href}>{voltar.rotulo}</a>
          </Botao>
        )}
      </div>
      {erro.digest && <p className="t-dado mt-6 text-[0.8125rem] text-texto-2">código: {erro.digest}</p>}
    </div>
  );
}
