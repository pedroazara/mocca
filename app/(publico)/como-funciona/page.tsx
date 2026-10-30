import { ArrowRight, Box, Clock, Cpu, Map as IconeMapa, MapPin, Ruler, Upload } from "lucide-react";
import type { Metadata } from "next";
import { ChamadaFinal } from "@/components/publico/chamada-final";
import { CurvasDeNivel } from "@/components/publico/curvas-de-nivel";
import { DiagramaColhedora } from "@/components/publico/diagrama-colhedora";
import { Acordeao, ItemAcordeao } from "@/components/ui/acordeao";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Como funciona",
  description:
    "Como o MoCCa mede o café na colhedora, registra onde cada volume foi colhido e transforma as medidas num mapa de produção por talhão.",
  alternates: { canonical: "/como-funciona" },
};

const medidas = [
  {
    Icone: Box,
    titulo: "Volume",
    texto: "Quanto café passa pela colhedora, medido o tempo todo enquanto ela trabalha.",
  },
  {
    Icone: MapPin,
    titulo: "Posição",
    texto: "Onde a colhedora estava em cada medida, pelo GPS.",
  },
  {
    Icone: Clock,
    titulo: "Horário",
    texto: "Quando cada medida foi feita, para refazer o caminho da máquina na lavoura.",
  },
];

const maturacao = [
  { nome: "Verde", cor: "bg-ok" },
  { nome: "Cereja", cor: "bg-erro" },
  { nome: "Passa", cor: "bg-torra" },
  { nome: "Boia", cor: "bg-espresso" },
];

const fluxo = [
  {
    Icone: Ruler,
    titulo: "Medição",
    texto: "Durante a colheita, cada medida guarda volume, posição e horário.",
  },
  {
    Icone: Upload,
    titulo: "Envio",
    texto: "As medidas saem da colhedora e chegam ao sistema da equipe.",
  },
  {
    Icone: Cpu,
    titulo: "Processamento",
    texto: "O sistema junta as medidas de cada talhão e soma o volume colhido em cada área.",
  },
  {
    Icone: IconeMapa,
    titulo: "Mapa",
    texto: "O resultado vira um mapa de produção, talhão por talhão.",
  },
];

// TODO(pedro): revisar as respostas das perguntas frequentes (seção 16).
const perguntas = [
  {
    pergunta: "Funciona em qualquer colhedora?",
    resposta:
      "Ainda estamos testando. A ideia é que o equipamento possa ser instalado em colhedoras de modelos diferentes, sem mudar o jeito de colher. Os testes de campo vão mostrar em quais ele já funciona bem.",
  },
  {
    pergunta: "Precisa de internet no campo?",
    resposta:
      "Não deve precisar. Estamos projetando o equipamento para guardar as medidas durante a colheita e enviá-las quando houver sinal. Isso também está em teste.",
  },
  {
    pergunta: "Quando estará disponível?",
    resposta:
      "Ainda não há data. O MoCCa é um protótipo em desenvolvimento, e o próximo passo são os testes de campo com produtores. Se você quer acompanhar ou participar, fale com a equipe.",
  },
];

function CabecalhoSecao({ numero, titulo }: { numero: string; titulo: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="t-dado text-[0.9375rem] text-link">{numero}</span>
      <h2 className="t-h2 text-texto md:text-[2rem]">{titulo}</h2>
    </div>
  );
}

export default function ComoFunciona() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-linha">
        <CurvasDeNivel
          conjunto="rodape"
          className="absolute inset-0 -z-10 h-full w-full text-caramelo/30 [mask-image:linear-gradient(to_right,transparent_35%,black_80%)]"
        />
        <div className="conteiner pt-12 pb-16 md:pt-20 md:pb-24">
          <p className="t-rotulo text-link">Como funciona</p>
          <h1 className="t-h1 mt-4 max-w-[20ch] text-texto md:text-[3rem] md:leading-[1.08]">
            Como o MoCCa mede a colheita
          </h1>
          <p className="medida mt-6 text-[1.125rem] text-texto-2">
            Uma tecnologia instalada na colhedora mede o café enquanto ele é colhido. Cada medida guarda quanto café
            passou, onde e quando. Somadas, as medidas formam o mapa de produção da lavoura.
          </p>
          <nav aria-label="Nesta página" className="mt-10 flex flex-wrap gap-2">
            {[
              ["#onde-fica", "Onde fica"],
              ["#o-que-mede", "O que mede"],
              ["#sacas", "Volume e sacas"],
              ["#do-campo-ao-mapa", "Do campo ao mapa"],
              ["#perguntas", "Perguntas"],
            ].map(([href, rotulo]) => (
              <a
                key={href}
                href={href}
                className="inline-flex h-9 items-center rounded-full border border-linha bg-superficie px-4 text-[0.875rem] font-medium text-texto-2 transition-colors duration-150 ease-out hover:border-texto-2/50 hover:text-texto"
              >
                {rotulo}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* 1. Onde fica */}
      <section id="onde-fica" className="secao scroll-mt-20">
        <div className="conteiner grid items-center gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <div>
            <CabecalhoSecao numero="01" titulo="Onde o equipamento fica na colhedora" />
            <p className="medida mt-5 text-texto-2">
              A colhedora passa por cima da fileira de café. As hastes vibram, o café cai, sobe pela lateral da
              máquina e sai por um tubo no alto, caindo no depósito.
            </p>
            <p className="medida mt-4 text-texto-2">
              O equipamento do MoCCa fica nesse tubo de saída, por onde passa todo o café colhido. Assim ele mede a
              colheita sem atrapalhar o trabalho da máquina.
            </p>
          </div>
          <figure className="rounded-g border border-linha bg-superficie p-5 md:p-8">
            <DiagramaColhedora />
            <figcaption className="t-pequeno mt-4 text-texto-2">Esquema ilustrativo, sem escala.</figcaption>
          </figure>
        </div>
      </section>

      {/* 2. O que é medido */}
      <section id="o-que-mede" className="secao scroll-mt-20 bg-superficie">
        <div className="conteiner">
          <CabecalhoSecao numero="02" titulo="O que é medido" />
          <p className="medida mt-5 text-texto-2">
            Três informações por medida. Juntas, dizem quanto café saiu de cada pedaço da lavoura.
          </p>
          <ul className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
            {medidas.map(({ Icone, titulo, texto }) => (
              <li key={titulo} className="rounded-g border border-linha bg-fundo p-6 md:p-7">
                <span className="inline-flex size-11 items-center justify-center rounded-m bg-superficie-2">
                  <Icone aria-hidden strokeWidth={1.75} className="size-[22px] text-caramelo" />
                </span>
                <h3 className="t-h3 mt-5 text-texto">{titulo}</h3>
                <p className="mt-2 text-texto-2">{texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. Volume e sacas */}
      <section id="sacas" className="secao scroll-mt-20">
        <div className="conteiner grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <CabecalhoSecao numero="03" titulo="Como o volume vira sacas" />
            <p className="medida mt-5 text-texto-2">
              A saca de 60 kg é de café beneficiado. Entre o café que sai do pé e o café beneficiado, o peso muda
              bastante, e essa relação não é fixa.
            </p>
            <p className="medida mt-4 text-texto-2">
              Ela depende da maturação. Um volume com muito café cereja rende diferente de um volume com muito verde,
              passa ou boia. Por isso, para transformar volume em sacas é preciso um fator de conversão que muda ao
              longo da colheita.
            </p>
            <p className="medida mt-4 text-texto-2">
              Além do volume, a medição gera uma reconstrução 3D do café que passa, com a cor de cada fruto visto de
              cima. A equipe estuda usar essa reconstrução para estimar a maturação e o tamanho do fruto e, com isso,
              ajustar esse fator.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-g border border-linha bg-superficie p-6 md:p-8">
              <p className="t-rotulo text-texto-2">A conta</p>
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-dado text-[0.9375rem] text-texto">
                <span className="rounded-p bg-superficie-2 px-2.5 py-1">volume medido</span>
                <span aria-hidden className="text-texto-2">×</span>
                <span className="sr-only">vezes</span>
                <span className="rounded-p border border-dashed border-caramelo px-2.5 py-1 text-link">
                  fator de conversão
                </span>
                <span aria-hidden className="text-texto-2">=</span>
                <span className="sr-only">igual a</span>
                <span className="rounded-p bg-botao-primario px-2.5 py-1 text-botao-primario-texto">
                  estimativa de sacas
                </span>
              </div>
              <p className="t-pequeno mt-5 text-texto-2">
                O fator muda com a maturação do café colhido. É ele que a equipe estuda estimar por imagem.
              </p>
            </div>

            <div className="rounded-g border border-linha bg-superficie p-6 md:p-8">
              <p className="t-rotulo text-texto-2">O que muda o fator</p>
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {maturacao.map((m) => (
                  <li key={m.nome} className="flex items-center gap-2.5 rounded-m bg-fundo px-3 py-2.5">
                    <span aria-hidden className={cn("size-3.5 shrink-0 rounded-full", m.cor)} />
                    <span className="text-[0.9375rem] text-texto">{m.nome}</span>
                  </li>
                ))}
              </ul>
              <p className="t-pequeno mt-4 text-texto-2">Estágios de maturação do fruto. Também está em estudo o tamanho do fruto.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Do campo ao mapa */}
      <section id="do-campo-ao-mapa" className="secao relative isolate scroll-mt-20 overflow-hidden bg-superficie">
        <CurvasDeNivel
          conjunto="cartao"
          className="absolute -right-40 -bottom-40 -z-10 size-[640px] text-caramelo/15 [mask-image:radial-gradient(circle,black,transparent_70%)]"
        />
        <div className="conteiner">
          <CabecalhoSecao numero="04" titulo="Do campo ao mapa" />
          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            {fluxo.map(({ Icone, titulo, texto }, i) => (
              <li key={titulo} className="relative flex flex-col rounded-g border border-linha bg-fundo p-6">
                <div className="flex items-center justify-between">
                  <span className="inline-flex size-11 items-center justify-center rounded-full border border-caramelo/50">
                    <Icone aria-hidden strokeWidth={1.75} className="size-[22px] text-caramelo" />
                  </span>
                  <span className="t-dado text-[0.8125rem] text-texto-2">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="t-h3 mt-6 text-texto">{titulo}</h3>
                <p className="mt-2 text-texto-2">{texto}</p>
                {i < fluxo.length - 1 && (
                  <ArrowRight
                    aria-hidden
                    strokeWidth={1.75}
                    className="absolute top-1/2 -right-[19px] z-10 hidden size-[22px] -translate-y-1/2 rounded-full bg-superficie text-caramelo lg:block"
                  />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5. Perguntas frequentes */}
      <section id="perguntas" className="secao scroll-mt-20">
        <div className="conteiner grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div>
            <CabecalhoSecao numero="05" titulo="Perguntas frequentes" />
            <p className="medida mt-5 text-texto-2">
              Respostas honestas para um projeto que ainda está em teste.
            </p>
          </div>
          <Acordeao type="single" collapsible className="border-t border-linha">
            {perguntas.map((p, i) => (
              <ItemAcordeao key={p.pergunta} valor={`p${i}`} pergunta={p.pergunta}>
                <p>{p.resposta}</p>
              </ItemAcordeao>
            ))}
          </Acordeao>
        </div>
      </section>

      <ChamadaFinal />
    </>
  );
}
