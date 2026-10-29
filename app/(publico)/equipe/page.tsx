import type { Metadata } from "next";
import { ChamadaFinal } from "@/components/publico/chamada-final";
import { CurvasDeNivel } from "@/components/publico/curvas-de-nivel";
import { estudantes, orientador, type Integrante } from "@/lib/equipe";

export const metadata: Metadata = {
  title: "Equipe",
  description:
    "Estudantes de engenharia da Universidade Federal de Lavras, com orientação do Departamento de Física, que estão construindo o MoCCa.",
  alternates: { canonical: "/equipe" },
};

// Placeholder da foto (seção 4.8): iniciais grandes sobre a cor da pessoa.
// TODO(pedro): trocar pelas fotos reais quando houver.
function Retrato({ pessoa }: { pessoa: Integrante }) {
  return (
    <div
      className="relative isolate flex aspect-[4/3] items-end overflow-hidden rounded-m p-5 text-creme"
      style={{ backgroundColor: pessoa.cor }}
      role="img"
      aria-label={`Foto de ${pessoa.nome} (em breve)`}
    >
      <CurvasDeNivel conjunto="cartao" className="absolute inset-0 -z-10 h-full w-full text-creme/[0.14]" />
      <span aria-hidden className="font-titulo text-[4.5rem] leading-none font-semibold tracking-[-0.02em]">
        {pessoa.iniciais}
      </span>
    </div>
  );
}

function Cartao({ pessoa, rotulo }: { pessoa: Integrante; rotulo: string }) {
  return (
    <article className="flex flex-col rounded-g border border-linha bg-superficie p-3">
      <Retrato pessoa={pessoa} />
      <div className="flex flex-1 flex-col px-3 pt-5 pb-4">
        <p className="t-rotulo text-texto-2">{rotulo}</p>
        <h2 className="mt-2 font-titulo text-[1.25rem] leading-tight font-semibold text-texto">{pessoa.nome}</h2>
        <p className="mt-2 text-texto-2">{pessoa.frase}</p>
        {pessoa.linkedin && (
          <a href={pessoa.linkedin} className="link mt-4 text-[0.9375rem]" target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        )}
      </div>
    </article>
  );
}

export default function Equipe() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-linha">
        <CurvasDeNivel
          conjunto="rodape"
          className="absolute inset-0 -z-10 h-full w-full text-caramelo/30 [mask-image:linear-gradient(to_right,transparent_40%,black_85%)]"
        />
        <div className="conteiner pt-12 pb-16 md:pt-20 md:pb-20">
          <p className="t-rotulo text-link">Equipe</p>
          <h1 className="t-h1 mt-4 text-texto md:text-[3rem] md:leading-[1.08]">Quem está construindo</h1>
          <p className="medida mt-6 text-[1.125rem] text-texto-2">
            Somos estudantes de engenharia da Universidade Federal de Lavras, com orientação do Departamento de
            Física.
          </p>
        </div>
      </section>

      <section className="secao">
        <div className="conteiner">
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {estudantes.map((p) => (
              <li key={p.nome} className="flex">
                <Cartao pessoa={p} rotulo={p.curso} />
              </li>
            ))}
          </ul>

          <div className="mt-16 border-t border-linha pt-12">
            <p className="t-rotulo text-texto-2">Orientação</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              <Cartao pessoa={orientador} rotulo="Orientador" />
              <div className="flex flex-col justify-center rounded-g border border-dashed border-linha p-7 lg:col-span-2">
                <p className="t-rotulo text-texto-2">{orientador.curso}</p>
                <p className="medida mt-3 text-texto-2">
                  O MoCCa nasceu dentro da universidade e segue com acompanhamento do Departamento de Física. A equipe
                  participa do Avança Café, programa de pré-aceleração coordenado pela Embrapa Café e executado pela
                  UFV (tecnoPARQ) e pela UFLA (LavrasTec).
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ChamadaFinal
        titulo="Quer conversar com a equipe?"
        texto="Produtores, fabricantes, pesquisadores ou imprensa: respondemos em até 3 dias úteis."
      />
    </>
  );
}
