import { ArrowRight, Check, MapPinOff, Scale, Sprout, Tractor } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChamadaFinal } from "@/components/publico/chamada-final";
import { CurvasDeNivel } from "@/components/publico/curvas-de-nivel";
import { MapaProdutividade } from "@/components/publico/mapa-produtividade";
import { GradeTalhoes, LegendaProducao, posicaoDoTalhao } from "@/components/publico/grade-talhoes";
import { Pin } from "@/components/publico/logo";
import { VinhetaLocaliza, VinhetaMapeia, VinhetaMede } from "@/components/publico/passos-ilustrados";
import { Botao } from "@/components/ui/botao";
import { Chip, type EstadoChip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "MoCCa · Monitoramento de colheita de café" },
  description:
    "O MoCCa mede o café enquanto ele é colhido e guarda de onde saiu cada volume. O resultado é um mapa de produção, talhão por talhão.",
  alternates: { canonical: "/" },
};

const problemas = [
  {
    Icone: MapPinOff,
    titulo: "Sem endereço",
    texto: "O volume chega ao terreiro sem registro de onde foi colhido.",
  },
  {
    Icone: Scale,
    titulo: "Só o total",
    texto: "O caderno e a planilha guardam a soma da safra, não o mapa.",
  },
  {
    Icone: Sprout,
    titulo: "Decisão no escuro",
    texto: "Investir no talhão errado custa a safra seguinte.",
  },
];

const passos = [
  {
    numero: "01",
    titulo: "Mede",
    texto: "Uma tecnologia instalada na colhedora mede o volume de café que passa por ela.",
    Vinheta: VinhetaMede,
  },
  {
    numero: "02",
    titulo: "Localiza",
    texto: "Cada medida recebe a posição por GPS.",
    Vinheta: VinhetaLocaliza,
  },
  {
    numero: "03",
    titulo: "Mapeia",
    texto: "O volume vira um mapa de produção por talhão.",
    Vinheta: VinhetaMapeia,
  },
];

const oQueVe = [
  "Volume colhido por área",
  "Localização de cada medida",
  "Estimativa de sacas",
  "Em estudo: maturação e tamanho do fruto",
];

const etapas: { texto: string; estado: EstadoChip; rotulo: string }[] = [
  { texto: "Protótipo funcional de medição de volume", estado: "ok", rotulo: "concluído" },
  { texto: "Pesquisa com cafeicultores de Minas Gerais", estado: "ok", rotulo: "concluído" },
  { texto: "Pré-aceleração no programa Avança Café", estado: "info", rotulo: "em andamento" },
  // TODO(pedro): confirmar a previsão dos testes de campo (seção 16).
  { texto: "Testes de campo na safra 2027", estado: "neutro", rotulo: "planejado" },
];

// talhão do cartão flutuante na seção "O que você passa a ver"
const TALHAO_DESTAQUE = 6;

export default function Inicio() {
  const destaque = posicaoDoTalhao("grande", TALHAO_DESTAQUE);

  return (
    <>
      {/* 1. Hero */}
      <section className="relative isolate overflow-hidden">
        <CurvasDeNivel
          conjunto="hero"
          className={cn(
            "absolute inset-0 -z-10 h-full w-full text-caramelo/30",
            "[mask-image:linear-gradient(to_bottom,transparent_35%,black_75%)]",
            "lg:[mask-image:linear-gradient(to_right,transparent_30%,black_62%)]",
          )}
        />
        <div className="conteiner grid items-center gap-12 pt-10 pb-16 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-20 lg:pb-24">
          <div>
            <p className="t-rotulo text-link">Monitoramento de colheita de café</p>
            <h1 className="t-display mt-5 max-w-[14ch] text-texto">
              Cada saca tem um <span className="text-caramelo">endereço</span>.
            </h1>
            <p className="medida mt-6 max-w-[56ch] text-[1.125rem] leading-[1.65] text-texto-2">
              No fim da safra, o cafeicultor sabe quantas sacas colheu na fazenda inteira. O que ele não sabe é de
              onde elas vieram. O MoCCa mede o café enquanto ele é colhido e guarda onde cada volume saiu, talhão
              por talhão.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Botao asChild>
                <Link href="/como-funciona">
                  Veja como funciona
                  <ArrowRight aria-hidden />
                </Link>
              </Botao>
              <Botao asChild variante="secundario">
                <Link href="/contato">Fale com a equipe</Link>
              </Botao>
            </div>
          </div>

          <figure className="relative mx-auto w-full max-w-[600px]">
            <MapaProdutividade />
            <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="t-rotulo text-texto-2">Mapa ilustrativo</span>
              <LegendaProducao />
            </figcaption>
          </figure>
        </div>
      </section>

      {/* 2. O problema */}
      <section className="secao bg-superficie">
        <div className="conteiner">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
              <p className="t-rotulo text-texto-2">O problema</p>
              <h2 className="t-h2 mt-3 text-texto md:text-[2rem]">A média esconde o talhão fraco.</h2>
            </div>
            <p className="medida text-texto-2 lg:pt-8">
              O total da safra mistura áreas boas e ruins. Sem saber de onde veio cada saca, adubação, renovação e
              manejo são decididos às cegas.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 md:gap-6">
            <figure className="rounded-g border border-linha bg-fundo p-5 md:p-6">
              <figcaption className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span className="t-rotulo text-texto-2">O que a planilha mostra</span>
                <span className="t-pequeno text-texto-2">um número só</span>
              </figcaption>
              <GradeTalhoes
                variante="mini"
                uniforme
                titulo="A mesma lavoura pintada com uma cor só: a média da safra"
                className="mx-auto mt-5 max-w-[340px]"
              />
            </figure>
            <figure className="rounded-g border border-linha bg-fundo p-5 md:p-6">
              <figcaption className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span className="t-rotulo text-texto-2">O que a lavoura tem</span>
                <span className="t-pequeno text-texto-2">cada talhão rende diferente</span>
              </figcaption>
              <GradeTalhoes
                variante="mini"
                titulo="A mesma lavoura com cada talhão numa faixa de produção diferente"
                className="mx-auto mt-5 max-w-[340px]"
              />
            </figure>
          </div>
          <p className="t-pequeno mt-3 text-texto-2">Ilustração. Não são dados de uma fazenda real.</p>

          <ul className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
            {problemas.map(({ Icone, titulo, texto }) => (
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

      {/* 3. Como funciona (resumo) */}
      <section className="secao">
        <div className="conteiner">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="t-rotulo text-texto-2">Como funciona</p>
              <h2 className="t-h2 mt-3 text-texto md:text-[2rem]">Medir enquanto colhe.</h2>
            </div>
            <Link href="/como-funciona" className="link inline-flex items-center gap-1.5 font-medium">
              Detalhes técnicos
              <ArrowRight aria-hidden strokeWidth={1.75} className="size-[18px]" />
            </Link>
          </div>

          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0">
            {passos.map(({ numero, titulo, texto, Vinheta }, i) => (
              <li key={numero} className="relative md:pr-8">
                <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-g border border-linha bg-superficie p-5">
                  <Vinheta className="max-h-full" />
                </div>
                <div
                  className={cn(
                    "mt-6 flex items-center gap-3",
                    i < passos.length - 1 &&
                      "md:after:ml-2 md:after:h-0 md:after:flex-1 md:after:border-t-2 md:after:border-dotted md:after:border-caramelo/60 md:after:content-['']",
                  )}
                >
                  <Pin tamanho={26} />
                  <span className="t-dado text-[0.875rem] text-texto-2">{numero}</span>
                </div>
                <h3 className="t-h3 mt-3 text-texto">{titulo}</h3>
                <p className="mt-2 max-w-[36ch] text-texto-2">{texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. O que você passa a ver */}
      <section className="secao relative isolate overflow-hidden border-y border-linha">
        <div className="conteiner grid items-center gap-12 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
          <figure className="order-2 lg:order-1">
            <div className="relative">
              <GradeTalhoes
                variante="grande"
                numeros
                destaque={TALHAO_DESTAQUE}
                titulo="Mapa ilustrativo com a produção de cada talhão em cinco faixas"
              />
              <div
                className="absolute"
                style={{ left: `${destaque.esquerda}%`, top: `${destaque.topo}%` }}
              >
                <span className="absolute -top-[6px] -left-[6px] size-3 rounded-full border-2 border-superficie bg-texto" />
                <span className="absolute top-0 left-0 h-10 w-0 -translate-y-full border-l border-texto/60" />
                <div className="absolute bottom-10 left-0 w-max -translate-x-1/2 rounded-m border border-linha bg-superficie px-3.5 py-2.5 shadow-flutuante sm:-left-4 sm:translate-x-0">
                  <p className="t-dado text-[0.8125rem] font-medium text-texto">
                    Talhão {destaque.numero}
                    <span className="hidden text-texto-2 sm:inline"> · </span>
                    <br className="sm:hidden" />
                    <span className="font-normal text-texto-2">volume colhido: [ilustrativo]</span>
                  </p>
                </div>
              </div>
            </div>
            <figcaption className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="t-pequeno text-texto-2">Mapa ilustrativo. Dados reais virão dos testes de campo.</span>
              <LegendaProducao />
            </figcaption>
          </figure>

          <div className="order-1 lg:order-2">
            <p className="t-rotulo text-texto-2">O que você passa a ver</p>
            <h2 className="t-h2 mt-3 text-texto md:text-[2rem]">O mapa que faltava na lavoura.</h2>
            <p className="medida mt-4 text-texto-2">
              Cada medida guarda quanto café passou e onde a colhedora estava. Somadas, elas mostram quanto cada
              talhão rendeu na safra.
            </p>
            <ul className="mt-8 space-y-4">
              {oQueVe.map((item) => (
                <li key={item} className="flex items-start gap-3.5">
                  <Pin tamanho={22} className="mt-0.5" />
                  <span className="text-texto">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 5. Para quem */}
      <section className="secao">
        <div className="conteiner">
          <p className="t-rotulo text-texto-2">Para quem</p>
          <h2 className="t-h2 mt-3 text-texto md:text-[2rem]">Quem ganha com o mapa.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 md:gap-6">
            {[
              {
                Icone: Sprout,
                titulo: "Produtores",
                texto: "Para saber quais talhões rendem mais e decidir onde investir.",
              },
              {
                Icone: Tractor,
                titulo: "Fabricantes e locadoras de máquinas",
                texto: "Para entregar a colhedora com mapa de produção, como já acontece em grãos.",
              },
            ].map(({ Icone, titulo, texto }) => (
              <article
                key={titulo}
                className="relative isolate overflow-hidden rounded-g border border-linha bg-superficie p-7 md:p-9"
              >
                <CurvasDeNivel
                  conjunto="cartao"
                  className="absolute -top-16 -right-16 -z-10 size-72 text-caramelo/20 [mask-image:radial-gradient(circle_at_70%_30%,black,transparent_70%)]"
                />
                <span className="inline-flex size-11 items-center justify-center rounded-m bg-superficie-2">
                  <Icone aria-hidden strokeWidth={1.75} className="size-[22px] text-caramelo" />
                </span>
                <h3 className="t-h3 mt-6 text-texto">{titulo}</h3>
                <p className="mt-2 max-w-[42ch] text-texto-2">{texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Estágio do projeto */}
      <section className="secao bg-superficie">
        <div className="conteiner grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <p className="t-rotulo text-texto-2">Estágio do projeto</p>
            <h2 className="t-h2 mt-3 text-texto md:text-[2rem]">Onde estamos.</h2>
            <p className="medida mt-4 text-texto-2">
              O MoCCa é um protótipo em desenvolvimento, feito por estudantes da Universidade Federal de Lavras.
            </p>
          </div>
          <ol className="relative">
            {etapas.map((e, i) => (
              <li key={e.texto} className="relative flex gap-5 pb-8 last:pb-0">
                {i < etapas.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-7 bottom-0 left-[13px] w-0 border-l-2",
                      e.estado === "ok" ? "border-caramelo" : "border-dotted border-linha",
                    )}
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                    e.estado === "ok" && "bg-caramelo text-superficie",
                    e.estado === "info" && "border-2 border-caramelo bg-superficie",
                    e.estado === "neutro" && "border-2 border-dashed border-texto-2/50 bg-superficie",
                  )}
                >
                  {e.estado === "ok" && <Check strokeWidth={2.5} className="size-4" />}
                  {e.estado === "info" && <span className="size-2.5 rounded-full bg-caramelo" />}
                </span>
                <div className="flex flex-1 flex-col gap-2 border-b border-linha pb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-6 [li:last-child_&]:border-0 [li:last-child_&]:pb-0">
                  <p className="font-medium text-texto">{e.texto}</p>
                  <Chip estado={e.estado}>{e.rotulo}</Chip>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 7. Chamada final */}
      <ChamadaFinal />
    </>
  );
}
