import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChamadaFinal } from "@/components/publico/chamada-final";
import { CurvasDeNivel } from "@/components/publico/curvas-de-nivel";
import { DiagramaColhedora } from "@/components/publico/diagrama-colhedora";
import { RamoCafe } from "@/components/publico/ilustracoes-publico";
import { PainelColhedora } from "@/components/publico/painel-colhedora";
import { PrototipoBancada } from "@/components/publico/prototipo-bancada";
import { WhatsappNoEscuro } from "@/components/publico/whatsapp";
import { Botao } from "@/components/ui/botao";
import { Chip, type EstadoChip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "MoCCa · Monitoramento de colheita de café" },
  description:
    "O MoCCa mede o café na colhedora e mostra quantas sacas saíram de cada talhão.",
  alternates: { canonical: "/" },
};

// As três etapas do painel da colhedora, em uma frase cada. O problema, o passo a
// passo e o mapa interativo ficam em /como-funciona.
const resumo = [
  {
    titulo: "Mede na colhedora",
    texto: "O equipamento fica no alto da máquina, na saída do café, e mede o volume que passa o tempo todo.",
  },
  {
    titulo: "Localiza cada medida",
    texto: "Cada medida guarda a posição por GPS e vira uma estimativa de sacas de 60 kg.",
  },
  {
    titulo: "Mostra no mapa",
    texto: "Somadas, as medidas formam o mapa de produção da lavoura, talhão por talhão.",
  },
];

// Estágio informado pelo Pedro em 2026-11-12: protótipo de testes em bancada, com a
// equipe comparando tecnologias e métodos de medição; primeiro piloto até a safra de 2027.
const etapas: { titulo: string; detalhe: string; estado: EstadoChip; rotulo: string }[] = [
  {
    titulo: "Pesquisa com produtores",
    detalhe: "Conversas com cafeicultores de Minas Gerais para entender como a colheita é acompanhada hoje.",
    estado: "ok",
    rotulo: "concluído",
  },
  {
    titulo: "Protótipo de bancada",
    detalhe: "Uma esteira com o equipamento de medição por cima, montada para testar fora da lavoura.",
    estado: "ok",
    rotulo: "concluído",
  },
  {
    titulo: "Testes de medição",
    detalhe: "Comparação de tecnologias e métodos de medição no protótipo.",
    estado: "info",
    rotulo: "em andamento",
  },
  {
    titulo: "Avança Café",
    detalhe: "Programa de pré-aceleração coordenado pela Embrapa Café.",
    estado: "info",
    rotulo: "em andamento",
  },
  {
    titulo: "Primeiro piloto em campo",
    detalhe: "O equipamento na colhedora, em uma lavoura. Previsto até a safra de 2027.",
    estado: "neutro",
    rotulo: "planejado",
  },
];

// os dois públicos da seção "Para quem"; cada botão abre o formulário já com o perfil escolhido
const publicos = [
  {
    nome: "Produtores de café",
    texto: "Compare a colheita de cada talhão com os mapas que você já usa e decida onde investir.",
    botao: "Quero testar na lavoura",
    href: "/contato?perfil=produtor",
    whatsapp: true, // produtor costuma preferir o WhatsApp ao formulário
    fundo: "bg-espresso",
    Ilustracao: RamoCafe,
    lugar: "-mr-7 -mb-7 md:mr-0 md:mb-0 md:-right-3 md:-bottom-6 md:w-[56%] md:max-w-[23rem]",
  },
  {
    nome: "Fabricantes e locadoras de máquinas",
    texto: "Entregue a colhedora de café com o mapa de produção que a agricultura de precisão já usa em grãos.",
    botao: "Quero ser parceiro",
    href: "/contato?perfil=fabricante",
    whatsapp: false,
    fundo: "bg-torra",
    Ilustracao: DiagramaColhedora,
    lugar: "[--desenho-destaque:var(--creme)] [--fundo-desenho:var(--torra)] -mr-3 w-full md:mr-0 md:right-6 md:bottom-6 md:w-[46%] md:max-w-[24rem]",
  },
];

export default function Inicio() {

  return (
    <>
      {/* 1. Topo: a frase, os botões e o painel da colhedora com o MoCCa */}
      {/* overflow-x-clip, e não hidden: o painel gruda na tela enquanto a página rola */}
      <section className="relative isolate overflow-x-clip">
        <CurvasDeNivel
          conjunto="rodape"
          className="absolute inset-x-0 top-0 -z-10 h-[34rem] w-full text-caramelo/20 [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
        />
        <div className="conteiner pt-10 pb-16 md:pt-14 lg:pb-24">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-end lg:gap-16">
            <div>
              <p className="t-rotulo text-link">Agricultura de precisão no café</p>
              <h1 className="t-display mt-5 max-w-[14ch] text-texto">
                Cada saca tem um <span className="text-caramelo">endereço</span>.
              </h1>
            </div>
            <div>
              <p className="medida text-[1.125rem] leading-[1.65] text-texto-2">
                No fim da safra, você sabe quantas sacas colheu na fazenda inteira, mas não de onde elas vieram. O
                MoCCa vai na colhedora, mede o café que passa e mostra quanto saiu de cada talhão.
              </p>
              {/* o cabeçalho já tem "Fale com a equipe": aqui o botão principal leva o produtor ao formulário */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Botao asChild>
                  <Link href="/contato?perfil=produtor">
                    Quero testar na lavoura
                    <ArrowRight aria-hidden />
                  </Link>
                </Botao>
                <Botao asChild variante="secundario">
                  <Link href="/como-funciona">Veja como funciona</Link>
                </Botao>
              </div>
            </div>
          </div>

          <PainelColhedora className="mt-10 lg:mt-12" />

          {/* o que o painel mostra, em três frases; a explicação completa está em Como funciona */}
          <ol className="mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
            {resumo.map(({ titulo, texto }, i) => (
              <li key={titulo} className="border-t border-linha pt-5">
                <p className="t-dado text-[0.875rem] font-medium text-link">{String(i + 1).padStart(2, "0")}</p>
                <h2 className="t-h3 mt-2 text-texto">{titulo}</h2>
                <p className="mt-2 max-w-[38ch] text-texto-2">{texto}</p>
              </li>
            ))}
          </ol>
          <Link href="/como-funciona" className="link mt-8 inline-flex items-center gap-1.5 font-medium">
            Veja o passo a passo
            <ArrowRight aria-hidden strokeWidth={1.75} className="size-[18px]" />
          </Link>
        </div>
      </section>

      {/* 2. Para quem */}
      <section className="secao border-t border-linha">
        <div className="conteiner">
          <p className="t-rotulo text-texto-2">Para quem</p>
          <h2 className="t-h2 mt-3 text-texto md:text-[2rem]">Quem ganha com o mapa.</h2>
          <div className="mt-10 grid gap-4 md:gap-6 xl:grid-cols-2">
            {publicos.map(({ nome, texto, botao, href, whatsapp, fundo, Ilustracao, lugar }) => (
              <article
                key={nome}
                className={cn("relative isolate flex flex-col overflow-hidden rounded-g p-7 text-creme md:min-h-[22rem] md:p-9 xl:min-h-[29rem]", fundo)}
              >
                <CurvasDeNivel
                  conjunto="cartao"
                  className="absolute -top-20 -left-20 -z-10 size-96 text-creme/15 [mask-image:radial-gradient(circle_at_40%_40%,black,transparent_72%)]"
                />
                <p className="t-rotulo text-creme/90">Para</p>
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
                  {whatsapp && <WhatsappNoEscuro className="mt-5" />}
                </div>
                <Ilustracao className={cn("mt-6 ml-auto w-4/5 max-w-[20rem] md:pointer-events-none md:absolute md:mt-0 md:-z-10", lugar)} />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Estágio do projeto */}
      <section className="secao bg-superficie">
        <div className="conteiner grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <p className="t-rotulo text-texto-2">Estágio do projeto</p>
            <h2 className="t-h2 mt-3 text-texto md:text-[2rem]">Onde estamos.</h2>
            <p className="medida mt-4 text-texto-2">
              O MoCCa é um projeto de estudantes da Universidade Federal de Lavras e hoje está em testes de bancada. O
              próximo passo é levar o equipamento para a colhedora, no primeiro piloto em campo, até a safra de 2027.
            </p>
            <figure className="mt-8 max-w-[30rem] rounded-g border border-linha bg-fundo p-5 md:p-6">
              <PrototipoBancada className="text-texto [--desenho-destaque:var(--caramelo)] [--fundo-desenho:var(--fundo)]" />
              <figcaption className="t-pequeno mt-3 text-texto-2">
                Protótipo de testes em bancada. Desenho ilustrativo.
              </figcaption>
            </figure>
          </div>
          <ol className="relative">
            {etapas.map((e, i) => (
              <li key={e.titulo} className="relative flex gap-5 pb-8 last:pb-0">
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
                  <div>
                    <p className="font-medium text-texto">{e.titulo}</p>
                    <p className="mt-1 max-w-[52ch] text-texto-2">{e.detalhe}</p>
                  </div>
                  {/* no celular a coluna estica os filhos: o selo fica do tamanho do texto */}
                  <Chip estado={e.estado} className="shrink-0 self-start">
                    {e.rotulo}
                  </Chip>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. Chamada final */}
      <ChamadaFinal />
    </>
  );
}
