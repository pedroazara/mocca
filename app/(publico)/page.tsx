import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChamadaFinal } from "@/components/publico/chamada-final";
import { CurvasDeNivel } from "@/components/publico/curvas-de-nivel";
import { ColhedoraLinha, RamoCafe } from "@/components/publico/ilustracoes-publico";
import { MapaProdutividade } from "@/components/publico/mapa-produtividade";
import { GradeTalhoes, LegendaProducao, mapas } from "@/components/publico/grade-talhoes";
import { MapaTalhoesInterativo } from "@/components/publico/mapa-talhoes-interativo";
import { PilhaCamadas, RotulosCamadas } from "@/components/publico/pilha-camadas";
import { VinhetaLocaliza, VinhetaMapeia, VinhetaMede } from "@/components/publico/passos-ilustrados";
import { VinhetaReconstroi } from "@/components/publico/vinheta-reconstroi";
import { VinhetaSacas } from "@/components/publico/vinheta-sacas";
import { Botao } from "@/components/ui/botao";
import { Chip, type EstadoChip } from "@/components/ui/chip";
import { infosDosTalhoes } from "@/lib/talhao-info";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "MoCCa · Monitoramento de colheita de café" },
  description:
    "O MoCCa mede o café na colhedora e mostra quantas sacas saíram de cada talhão.",
  alternates: { canonical: "/" },
};

// o que o produtor faz com a colheita no mapa (seção "A colheita é a camada que falta")
const usos = [
  "Conferir se a adubação deu resultado em cada talhão.",
  "Levar a produção de cada talhão para a recomendação de adubação.",
  "Achar o talhão fraco antes de decidir poda ou renovação.",
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
    titulo: "Reconstrói",
    texto: "O café medido vira um modelo 3D, com a cor de cada fruto.",
    Vinheta: VinhetaReconstroi,
  },
  {
    numero: "03",
    titulo: "Calcula",
    texto: "O volume medido vira uma estimativa de sacas de 60 kg.",
    Vinheta: VinhetaSacas,
  },
  {
    numero: "04",
    titulo: "Localiza",
    texto: "Cada medida recebe a posição por GPS.",
    Vinheta: VinhetaLocaliza,
  },
  {
    numero: "05",
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

// os dois públicos da seção "Para quem"; o botão do produtor abre o formulário já em "Produtor"
const publicos = [
  {
    nome: "Produtores de café",
    texto: "Compare a colheita de cada talhão com os mapas que você já usa e decida onde investir.",
    botao: "Quero testar na lavoura",
    href: "/contato?perfil=produtor",
    fundo: "bg-espresso",
    Ilustracao: RamoCafe,
    lugar: "-mr-7 -mb-7 md:mr-0 md:mb-0 md:-right-3 md:-bottom-6 md:w-[56%] md:max-w-[23rem]",
  },
  {
    nome: "Fabricantes e locadoras de máquinas",
    texto: "Entregue a colhedora de café com o mapa de produção que a agricultura de precisão já usa em grãos.",
    botao: "Quero ser parceiro",
    href: "/contato",
    fundo: "bg-torra",
    Ilustracao: ColhedoraLinha,
    lugar: "md:right-6 md:bottom-5 md:w-[42%] md:max-w-[18rem]",
  },
];

// talhão do cartão flutuante na seção "O que você passa a ver"
const TALHAO_DESTAQUE = 6;
// números ilustrativos de cada talhão para o mapa interativo
const INFOS = infosDosTalhoes(mapas.grande);

export default function Inicio() {

  return (
    <>
      {/* 1. Hero */}
      {/* as curvas de nível do fundo vêm do próprio mapa (ver MapaProdutividade) */}
      <section className="relative isolate overflow-hidden">
        <div className="conteiner grid items-center gap-12 pt-10 pb-16 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-20 lg:pb-24">
          <div>
            <p className="t-rotulo text-link">Agricultura de precisão no café</p>
            <h1 className="t-display mt-5 max-w-[14ch] text-texto">
              Cada saca tem um <span className="text-caramelo">endereço</span>.
            </h1>
            <p className="medida mt-6 max-w-[56ch] text-[1.125rem] leading-[1.65] text-texto-2">
              No fim da safra, o cafeicultor sabe quantas sacas colheu na fazenda inteira. O que ele não sabe é de
              onde elas vieram. O MoCCa mede o café enquanto ele é colhido e guarda de onde saiu cada volume e a
              qualidade geral do café, talhão por talhão.
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

      {/* 2. O problema: a colheita é a camada que falta na agricultura de precisão */}
      <section className="secao bg-superficie">
        <div className="conteiner">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
              <p className="t-rotulo text-texto-2">O problema</p>
              <h2 className="t-h2 mt-3 text-texto md:text-[2rem]">A colheita é a camada que falta.</h2>
            </div>
            <p className="medida text-texto-2 lg:pt-8">
              Quem faz agricultura de precisão costuma ter mapa de solo, de adubação em taxa variável e imagem de
              satélite ou drone. Quem irriga tem também o mapa da irrigação. A colheita, que mostra o resultado de
              tudo isso, quase sempre fica fora do mapa: vira o total da safra. O MoCCa mede o café na colhedora e
              põe a produção no mapa, talhão por talhão.
            </p>
          </div>

          <figure className="mt-12 rounded-g border border-linha bg-fundo p-5 md:p-8">
            {/* celular: cada pilha com os nomes à direita; do tablet em diante: pilha, nomes, pilha */}
            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-x-3 gap-y-4 md:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] md:gap-x-6 lg:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)]">
              <p className="t-rotulo col-span-2 text-texto-2 md:col-span-1 md:col-start-1 md:row-start-1">
                Sem monitoramento da colheita
              </p>
              <PilhaCamadas
                colheita="vazia"
                titulo="Ilustração: três camadas da mesma lavoura, uma sobre a outra (solo e adubação, irrigação, imagem de satélite ou drone). No alto, a camada da colheita, que mostra o resultado, está vazia. Um fio pontilhado liga o mesmo ponto em todas as camadas e termina numa interrogação. Não se sabe quanto café saiu dali."
                className="ml-auto max-w-[400px] md:mx-auto md:col-start-1 md:row-start-2"
              />
              <RotulosCamadas className="md:col-start-2 md:row-start-2" />

              <p className="t-rotulo col-span-2 mt-6 text-link md:col-span-1 md:col-start-3 md:row-start-1 md:mt-0">
                Com o MoCCa
              </p>
              <PilhaCamadas
                colheita="talhao"
                titulo="Ilustração: as mesmas três camadas da lavoura. No alto, a colheita medida pelo MoCCa, com cada talhão numa faixa de produção. O talhão marcado está na faixa mais baixa."
                className="ml-auto max-w-[400px] md:mx-auto md:col-start-3 md:row-start-2"
              />
              <RotulosCamadas className="md:hidden" />
            </div>
            <figcaption className="mt-6 flex flex-col gap-3 border-t border-linha pt-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="t-rotulo text-texto-2">Ilustração</span>
              <LegendaProducao />
            </figcaption>
          </figure>

          <div className="mt-10">
            <p className="t-rotulo text-texto-2">Com a colheita no mapa, dá para</p>
            <ul className="mt-4 grid gap-4 md:grid-cols-3 md:gap-6">
              {usos.map((uso) => (
                <li key={uso} className="flex gap-3 text-texto">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-caramelo" />
                  <span>{uso}</span>
                </li>
              ))}
            </ul>
          </div>
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

          {/* 5 passos: 2 por linha no tablet e, em telas largas, 3 em cima e 2 embaixo, centrados */}
          <ol className="mt-12 grid gap-10 md:grid-cols-4 md:gap-x-8 lg:grid-cols-6">
            {passos.map(({ numero, titulo, texto, Vinheta }, i) => (
              <li
                key={numero}
                className={cn(
                  "relative md:col-span-2",
                  i === 3 && "lg:col-start-2",
                  i === passos.length - 1 && "md:col-start-2 lg:col-start-auto",
                )}
              >
                <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-g border border-linha bg-superficie p-5">
                  <Vinheta className="max-h-full" />
                </div>
                <div
                  className={cn(
                    "mt-6 flex items-center gap-3",
                    i !== 2 &&
                      i < passos.length - 1 &&
                      "lg:after:ml-2 lg:after:-mr-8 lg:after:h-0 lg:after:flex-1 lg:after:border-t-2 lg:after:border-dotted lg:after:border-caramelo/60 lg:after:content-['']",
                  )}
                >
                  <span className="t-dado text-[0.875rem] font-medium text-caramelo">{numero}</span>
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
            <MapaTalhoesInterativo mapa={mapas.grande} infos={INFOS} inicial={TALHAO_DESTAQUE}>
              <GradeTalhoes
                variante="grande"
                numeros
                titulo="Mapa ilustrativo com a produção de cada talhão em cinco faixas"
              />
            </MapaTalhoesInterativo>
            <figcaption className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="t-pequeno text-texto-2">Mapa ilustrativo. Dados reais virão dos testes de campo.</span>
              <LegendaProducao />
            </figcaption>
          </figure>

          <div className="order-1 lg:order-2">
            <p className="t-rotulo text-texto-2">O que você passa a ver</p>
            <h2 className="t-h2 mt-3 text-texto md:text-[2rem]">A produção de cada talhão, no mapa.</h2>
            <p className="medida mt-4 text-texto-2">
              Os mapas de solo, adubação e irrigação mostram o que a lavoura tem e o que recebeu. A imagem de
              satélite ou de drone mostra como ela se desenvolveu. O mapa do MoCCa mostra o resultado: quanto café
              foi colhido em cada talhão na safra. Cruzando as camadas, fica mais fácil decidir onde ajustar a
              adubação em taxa variável e o manejo.
            </p>
            <ul className="mt-8 space-y-4">
              {oQueVe.map((item) => (
                <li key={item} className="flex items-start gap-3.5">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-caramelo" />
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
          <div className="mt-10 grid gap-4 md:gap-6 xl:grid-cols-2">
            {publicos.map(({ nome, texto, botao, href, fundo, Ilustracao, lugar }) => (
              <article
                key={nome}
                className={cn("relative isolate flex flex-col overflow-hidden rounded-g p-7 text-creme md:min-h-[22rem] md:p-9 xl:min-h-[27rem]", fundo)}
              >
                <CurvasDeNivel
                  conjunto="cartao"
                  className="absolute -top-20 -left-20 -z-10 size-96 text-creme/15 [mask-image:radial-gradient(circle_at_40%_40%,black,transparent_72%)]"
                />
                <p className="t-rotulo text-creme/75">Para</p>
                <h3 className="mt-2 max-w-[12ch] font-titulo text-[2.25rem] leading-[1.06] font-bold md:text-[2.5rem]">
                  {nome}
                </h3>
                <p className="mt-4 text-creme/90 md:max-w-[29ch]">{texto}</p>
                <div className="mt-6 md:mt-auto md:pt-8">
                  <Botao asChild variante="claro">
                    <Link href={href}>
                      {botao}
                      <ArrowRight aria-hidden />
                    </Link>
                  </Botao>
                </div>
                <Ilustracao className={cn("mt-6 ml-auto w-4/5 max-w-[20rem] md:pointer-events-none md:absolute md:mt-0 md:-z-10", lugar)} />
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
              Os primeiros mapas de produção virão dos testes de campo.
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
