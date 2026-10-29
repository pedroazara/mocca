import { Clock, Sprout } from "lucide-react";
import type { Metadata } from "next";
import { CurvasDeNivel } from "@/components/publico/curvas-de-nivel";
import { FormularioContato } from "@/components/publico/formulario-contato";
import { COORDENADA_LAVRAS } from "@/components/publico/navegacao";

export const metadata: Metadata = {
  title: "Contato",
  description:
    "Fale com a equipe do MoCCa. Produtores interessados nos testes de campo podem contar o tamanho da área e o tipo de colheita.",
  alternates: { canonical: "/contato" },
};

export default function Contato() {
  return (
    <section className="relative isolate overflow-hidden">
      <CurvasDeNivel
        conjunto="hero"
        className="absolute inset-x-0 top-0 -z-10 h-[520px] w-full text-caramelo/25 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div className="conteiner pt-12 pb-20 md:pt-20 md:pb-28">
        <p className="t-rotulo text-link">Contato</p>
        <h1 className="t-h1 mt-4 text-texto md:text-[3rem] md:leading-[1.08]">Fale com a equipe</h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
          <div className="rounded-g border border-linha bg-superficie p-5 sm:p-8">
            <FormularioContato />
          </div>

          <aside className="flex flex-col gap-6 lg:pt-2">
            <div className="flex gap-4">
              <Clock aria-hidden strokeWidth={1.75} className="mt-1 size-[22px] shrink-0 text-caramelo" />
              <p className="text-texto-2">Respondemos em até 3 dias úteis.</p>
            </div>
            <div className="flex gap-4">
              <Sprout aria-hidden strokeWidth={1.75} className="mt-1 size-[22px] shrink-0 text-caramelo" />
              <p className="text-texto-2">
                Se você é produtor e quer participar dos testes de campo, conte o tamanho da área e o tipo de colheita.
              </p>
            </div>
            <div className="mt-2 rounded-g border border-linha p-6">
              <p className="t-rotulo text-texto-2">Onde estamos</p>
              <p className="mt-3 text-texto">Universidade Federal de Lavras</p>
              <p className="text-texto-2">Lavras, MG</p>
              <p className="t-dado mt-2 text-[0.8125rem] text-texto-2">{COORDENADA_LAVRAS}</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
