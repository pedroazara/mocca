import Link from "next/link";
import { CurvasDeNivel } from "@/components/publico/curvas-de-nivel";
import { Botao } from "@/components/ui/botao";

export default function NaoEncontrada() {
  return (
    <main className="relative isolate flex min-h-dvh items-center overflow-hidden">
      <CurvasDeNivel conjunto="hero" className="absolute inset-0 -z-10 h-full w-full text-caramelo/25" />
      <div className="conteiner py-20">
        <p className="t-rotulo text-texto-2">Erro 404</p>
        <h1 className="t-h1 mt-3 max-w-[18ch] text-texto">Esta página não tem endereço.</h1>
        <p className="medida mt-4 text-texto-2">O link pode estar errado ou a página mudou de lugar.</p>
        <Botao asChild className="mt-8">
          <Link href="/">Voltar para o início</Link>
        </Botao>
      </div>
    </main>
  );
}
