import type { Metadata } from "next";
import { CurvasDeNivel } from "@/components/publico/curvas-de-nivel";
import { DefinicoesCurvas } from "@/components/publico/curvas-definicoes";
import { SimboloMascara } from "@/components/publico/logo";
import { Botao } from "@/components/ui/botao";
import { sair } from "../entrar/acoes";

export const metadata: Metadata = {
  title: "Acesso negado",
  robots: { index: false, follow: false },
};

export default function AcessoNegado() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <DefinicoesCurvas />
      <CurvasDeNivel conjunto="hero" className="absolute inset-0 -z-10 h-full w-full text-caramelo/20" />
      <div className="w-full max-w-[400px] rounded-g border border-linha bg-superficie p-8 shadow-cartao">
        <SimboloMascara className="h-10 text-linha" />
        <h1 className="t-h2 mt-6 text-texto">Acesso negado</h1>
        <p className="mt-2 text-[0.9375rem] text-texto-2">
          Este e-mail não faz parte da equipe MoCCa. Peça para o Pedro cadastrar você.
        </p>
        <form action={sair} className="mt-6">
          <Botao type="submit" variante="secundario" tamanho="painel">
            Sair
          </Botao>
        </form>
      </div>
    </main>
  );
}
