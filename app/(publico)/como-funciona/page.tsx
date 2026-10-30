import type { Metadata } from "next";
import { ChamadaFinal } from "@/components/publico/chamada-final";
import { CurvasDeNivel } from "@/components/publico/curvas-de-nivel";
import { DiagramaColhedora } from "@/components/publico/diagrama-colhedora";
import { LegendaProducao } from "@/components/publico/grade-talhoes";
import { VinhetaLocaliza, VinhetaMapeia, VinhetaMede } from "@/components/publico/passos-ilustrados";
import { PilhaCamadas, RotulosCamadas } from "@/components/publico/pilha-camadas";
import { VinhetaReconstroi } from "@/components/publico/vinheta-reconstroi";
import { VinhetaSacas } from "@/components/publico/vinheta-sacas";
import { Acordeao, ItemAcordeao } from "@/components/ui/acordeao";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Como funciona",
  description:
    "Como o MoCCa mede o café na colhedora e monta o mapa de produção de cada talhão.",
  alternates: { canonical: "/como-funciona" },
};

// Os mesmos cinco passos do Início, com a explicação completa. `ganha` é o que a
// medida passa a levar naquele passo: a lista cresce de um passo para o outro.
const passos = [
  {
    id: "mede",
    verbo: "Mede",
    resumo: "o volume que passa",
    titulo: "Mede o café que passa.",
    textos: [
      "O café que a colhedora derruba sai pelo tubo de saída. A tecnologia instalada ali mede o volume que passa, o tempo todo, enquanto a máquina trabalha.",
      "Esse é o dado principal: quanto café passou em cada momento da colheita.",
    ],
    ganha: "Volume",
    Vinheta: VinhetaMede,
  },
  {
    id: "reconstroi",
    verbo: "Reconstrói",
    resumo: "o café em 3D, com cor",
    titulo: "Reconstrói o café em 3D.",
    textos: [
      "Além do volume, a medição gera um modelo 3D do café, com a cor de cada fruto visto de cima. Os frutos de baixo ficam escondidos: entram no volume, mas não na cor.",
      "A equipe estuda usar esse modelo para estimar a maturação e o tamanho do fruto e, com eles, a qualidade geral do café.",
    ],
    ganha: "Cor dos frutos",
    Vinheta: VinhetaReconstroi,
  },
  {
    id: "calcula",
    verbo: "Calcula",
    resumo: "a estimativa de sacas",
    titulo: "Transforma volume em sacas.",
    textos: [
      "O produtor pensa em sacas de 60 kg de café beneficiado, mas o que passa pela colhedora é café da roça. Entre um e outro o peso muda bastante, e essa relação não é fixa.",
      "Ela depende da maturação: um volume com muito cereja rende diferente de um volume com muito verde, passa ou boia. Por isso o resultado é uma estimativa, feita com um fator de conversão que muda ao longo da colheita.",
    ],
    ganha: "Sacas estimadas",
    Vinheta: VinhetaSacas,
  },
  {
    id: "localiza",
    verbo: "Localiza",
    resumo: "cada medida por GPS",
    titulo: "Anota onde e quando.",
    textos: [
      "Cada medida recebe a posição por GPS e o horário em que foi feita.",
      "Com isso, dá para refazer o caminho da colhedora na lavoura e saber de qual talhão saiu cada volume.",
    ],
    ganha: "Posição e horário",
    Vinheta: VinhetaLocaliza,
  },
  {
    id: "mapeia",
    verbo: "Mapeia",
    resumo: "a produção por talhão",
    titulo: "Monta o mapa de produção.",
    textos: [
      "As medidas saem da colhedora e chegam ao sistema da equipe, que junta as medidas de cada talhão e soma o volume colhido em cada área.",
      "O resultado é o mapa de produção da lavoura, com cada talhão numa faixa, de baixa a alta.",
    ],
    ganha: "Talhão",
    Vinheta: VinhetaMapeia,
  },
];

const maturacao = [
  { nome: "Verde", cor: "bg-fruto-verde" },
  { nome: "Cereja", cor: "bg-fruto-cereja" },
  { nome: "Passa", cor: "bg-fruto-passa" },
  { nome: "Boia", cor: "bg-espresso" },
];

// o que o produtor faz com a colheita no mapa
const usos = [
  "Conferir se a adubação deu resultado em cada talhão.",
  "Levar a produção de cada talhão para a recomendação de adubação.",
  "Achar o talhão fraco antes de decidir poda ou renovação.",
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
    pergunta: "Substitui os mapas que eu já uso?",
    resposta:
      "Não. O mapa de produção é uma camada a mais, ao lado dos mapas de solo, adubação e irrigação e da imagem de satélite ou de drone. Os outros mostram o que a lavoura tem e como ela se desenvolveu. Ele mostra quanto café saiu de cada talhão.",
  },
  {
    pergunta: "O MoCCa mede a qualidade do café?",
    resposta:
      "Essa parte está em estudo. A reconstrução 3D mostra a cor dos frutos vistos de cima, e a equipe estuda usar isso para estimar a maturação e o tamanho do fruto e, com eles, a qualidade geral do café.",
  },
  {
    pergunta: "Quando estará disponível?",
    resposta:
      "Ainda não há data. O MoCCa é um protótipo em desenvolvimento, e o próximo passo são os testes de campo com produtores. Se você quer acompanhar ou participar, fale com a equipe.",
  },
];

const numero = (i: number) => String(i + 1).padStart(2, "0");

// Os cinco passos numa linha contínua, logo abaixo do título. Cada um leva à sua explicação.
function ResumoDosPassos() {
  return (
    <nav
      aria-label="Os cinco passos"
      className="relative isolate mt-12 overflow-hidden rounded-g bg-espresso p-7 text-creme md:p-9"
    >
      <CurvasDeNivel
        conjunto="cartao"
        className="absolute -top-24 -right-16 -z-10 size-[28rem] text-creme/15 [mask-image:radial-gradient(circle_at_60%_40%,black,transparent_72%)]"
      />
      <ol className="grid gap-7 lg:grid-cols-5 lg:gap-0">
        {passos.map(({ id, verbo, resumo }, i) => (
          <li key={id} className="relative pl-7 lg:pl-0 lg:pr-5">
            {i < passos.length - 1 && (
              <span
                aria-hidden
                className="absolute top-2 -bottom-7 left-[5px] w-px bg-creme/35 lg:top-[5px] lg:right-0 lg:bottom-auto lg:left-0 lg:h-px lg:w-auto"
              />
            )}
            <span aria-hidden className="absolute top-1 left-0 size-[11px] rounded-full bg-caramelo lg:top-0" />
            <a href={`#${id}`} className="group block lg:pt-6">
              <span className="t-dado block text-[0.8125rem] text-creme/70">{numero(i)}</span>
              <span className="mt-1 block font-titulo text-[1.5rem] leading-tight font-bold underline-offset-4 group-hover:underline">
                {verbo}
              </span>
              <span className="mt-1 block text-[0.9375rem] text-creme/85">{resumo}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Termo({ titulo, texto, children }: { titulo: string; texto: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="font-titulo text-[1.375rem] leading-tight font-bold md:text-[1.5rem]">{titulo}</p>
      <p className="mt-1.5 text-creme/85">{texto}</p>
      {children}
    </div>
  );
}

function Operador({ sinal, nome }: { sinal: string; nome: string }) {
  return (
    <p className="font-titulo text-[2rem] leading-none text-creme/70">
      <span aria-hidden>{sinal}</span>
      <span className="sr-only">{nome}</span>
    </p>
  );
}

// A conta do passo "Calcula", no mesmo painel escuro da seção "Para quem" do Início.
function ContaDasSacas() {
  return (
    <figure className="relative isolate overflow-hidden rounded-g bg-torra p-7 text-creme md:p-9 lg:col-span-2">
      <CurvasDeNivel
        conjunto="cartao"
        className="absolute -top-20 -left-20 -z-10 size-96 text-creme/15 [mask-image:radial-gradient(circle_at_40%_40%,black,transparent_72%)]"
      />
      <p className="t-rotulo text-creme/75">A conta</p>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_auto_1.5fr_auto_1fr] lg:gap-8">
        <Termo titulo="Volume medido" texto="O café que passou pelo tubo de saída." />
        <Operador sinal="×" nome="vezes" />
        <Termo titulo="Fator de conversão" texto="Muda com a maturação do café colhido.">
          <ul className="mt-3 flex flex-wrap gap-2">
            {maturacao.map((m) => (
              <li
                key={m.nome}
                className="inline-flex items-center gap-2 rounded-full bg-creme px-3 py-1 text-[0.875rem] font-medium text-espresso"
              >
                <span aria-hidden className={cn("size-2.5 rounded-full", m.cor)} />
                {m.nome}
              </li>
            ))}
          </ul>
        </Termo>
        <Operador sinal="=" nome="igual a" />
        <Termo titulo="Estimativa de sacas" texto="Em sacas de 60 kg de café beneficiado." />
      </div>
      <figcaption className="t-pequeno mt-7 border-t border-creme/25 pt-4 text-creme/85">
        É esse fator que a equipe estuda estimar pela reconstrução 3D do café.
      </figcaption>
    </figure>
  );
}

export default function ComoFunciona() {
  return (
    <>
      {/* 1. Título e os cinco passos */}
      <section className="relative isolate overflow-hidden">
        <CurvasDeNivel
          conjunto="rodape"
          className="absolute inset-0 -z-10 h-full w-full text-caramelo/20 [mask-image:linear-gradient(to_right,transparent_35%,black_80%)]"
        />
        <div className="conteiner pt-10 pb-16 md:pt-16 lg:pt-20 lg:pb-24">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-end lg:gap-16">
            <div>
              <p className="t-rotulo text-link">Como funciona</p>
              <h1 className="t-display mt-5 max-w-[14ch] text-texto">
                Do pé de café ao <span className="text-caramelo">mapa</span>.
              </h1>
            </div>
            <p className="medida text-[1.125rem] leading-[1.65] text-texto-2">
              Uma tecnologia instalada na colhedora mede o café enquanto ele é colhido. Cada medida guarda quanto café
              passou, onde e quando. Somadas, as medidas formam o mapa de produção da lavoura, uma camada a mais ao
              lado dos mapas de solo e de adubação.
            </p>
          </div>
          <ResumoDosPassos />
        </div>
      </section>

      {/* 2. Onde fica */}
      <section id="onde-fica" className="secao scroll-mt-24 bg-superficie">
        <div className="conteiner grid items-center gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <div>
            <p className="t-rotulo text-texto-2">Onde fica</p>
            <h2 className="t-h2 mt-3 text-texto md:text-[2rem]">No tubo por onde passa todo o café.</h2>
            <p className="medida mt-5 text-texto-2">
              A colhedora passa por cima da fileira de café. As hastes vibram, o café cai, sobe pela lateral da
              máquina e sai por um tubo no alto, que leva o café até o reservatório, puxado por outro trator.
            </p>
            <p className="medida mt-4 text-texto-2">
              O equipamento do MoCCa fica nesse tubo de saída, por onde passa todo o café colhido. Assim ele mede a
              colheita sem atrapalhar o trabalho da máquina.
            </p>
          </div>
          <figure className="rounded-g border border-linha bg-fundo p-5 md:p-8">
            <DiagramaColhedora rotulos className="text-texto [--desenho-destaque:var(--caramelo)] [--fundo-desenho:var(--fundo)]" />
            <figcaption className="t-pequeno mt-4 text-texto-2">Esquema ilustrativo, sem escala.</figcaption>
          </figure>
        </div>
      </section>

      {/* 3. Passo a passo */}
      <section className="secao">
        <div className="conteiner">
          <p className="t-rotulo text-texto-2">Passo a passo</p>
          <h2 className="t-h2 mt-3 text-texto md:text-[2rem]">Da colhedora ao mapa, em cinco passos.</h2>
          <p className="medida mt-4 text-texto-2">
            Cada medida nasce na colhedora e ganha informação a cada passo. No fim, ela é um pedaço do mapa da lavoura.
          </p>

          <ol className="mt-14 space-y-16 md:space-y-24">
            {passos.map(({ id, titulo, textos, Vinheta }, i) => (
              <li key={id} id={id} className="grid scroll-mt-24 items-center gap-8 lg:grid-cols-2 lg:gap-x-16 lg:gap-y-12">
                <div className={cn(i % 2 === 1 && "lg:order-2")}>
                  <p className="t-dado text-[0.875rem] font-medium text-caramelo">{numero(i)}</p>
                  <h3 className="t-h2 mt-3 text-texto md:text-[2rem]">{titulo}</h3>
                  {textos.map((texto) => (
                    <p key={texto} className="medida mt-4 text-texto-2">
                      {texto}
                    </p>
                  ))}
                  <div className="mt-6 border-t border-linha pt-5">
                    <p className="t-rotulo text-texto-2">O que a medida já leva</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {passos.slice(0, i + 1).map((p, k) => (
                        <li
                          key={p.id}
                          className={cn(
                            "rounded-full px-3 py-1 text-[0.875rem] font-medium",
                            k === i ? "bg-botao-primario text-botao-primario-texto" : "bg-superficie-2 text-texto-2",
                          )}
                        >
                          {p.ganha}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-g border border-linha bg-superficie p-5 md:p-8">
                  <Vinheta className="max-h-full" />
                </div>
                {id === "calcula" && <ContaDasSacas />}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. O resultado: uma camada a mais */}
      <section id="camada" className="secao scroll-mt-24 bg-superficie">
        <div className="conteiner grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <p className="t-rotulo text-texto-2">O resultado</p>
            <h2 className="t-h2 mt-3 text-texto md:text-[2rem]">Uma camada a mais nos seus mapas.</h2>
            <p className="medida mt-4 text-texto-2">
              Os mapas de solo, adubação e irrigação mostram o que a lavoura tem e o que recebeu. A imagem de satélite
              ou de drone mostra como ela se desenvolveu. O mapa do MoCCa mostra o resultado: quanto café foi colhido
              em cada talhão na safra.
            </p>
            <p className="t-rotulo mt-8 text-texto-2">Com a colheita no mapa, dá para</p>
            <ul className="mt-4 space-y-3">
              {usos.map((uso) => (
                <li key={uso} className="flex gap-3 text-texto">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-caramelo" />
                  <span>{uso}</span>
                </li>
              ))}
            </ul>
          </div>
          <figure className="rounded-g border border-linha bg-fundo p-5 md:p-8">
            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-x-3 md:grid-cols-[minmax(0,1fr)_9rem] md:gap-x-6">
              <PilhaCamadas
                colheita="talhao"
                titulo="Ilustração: as camadas da mesma lavoura, uma sobre a outra (solo e adubação, irrigação, imagem de satélite ou drone). No alto, a colheita medida pelo MoCCa, com cada talhão numa faixa de produção."
                className="mx-auto max-w-[400px]"
              />
              <RotulosCamadas />
            </div>
            <figcaption className="mt-6 flex flex-col gap-3 border-t border-linha pt-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="t-rotulo text-texto-2">Ilustração</span>
              <LegendaProducao />
            </figcaption>
          </figure>
        </div>
      </section>

      {/* 5. Perguntas frequentes */}
      <section id="perguntas" className="secao scroll-mt-24">
        <div className="conteiner grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div>
            <p className="t-rotulo text-texto-2">Perguntas</p>
            <h2 className="t-h2 mt-3 text-texto md:text-[2rem]">O que costumam perguntar.</h2>
            <p className="medida mt-4 text-texto-2">
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
