"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, ExternalLink, Inbox, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { criarReuniao } from "@/app/painel/acoes";
import { CurvasDeNivel } from "@/components/publico/curvas-de-nivel";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { dataCurta, dataLonga, diaCurto, diasAtePrazo, estaAtrasada, textoPrazo } from "@/lib/painel/datas";
import type { Contato, Semana, TarefaResumo } from "@/lib/painel/tipos";
import { rotuloStatus } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { EstadoVazio } from "./elementos";
import { CartaoTarefa } from "./tarefa-pecas";

// Tela "Semana" (seção 9.1): em 10 segundos, o que a equipe precisa entregar
// nesta semana e o que está atrasado. A entrega e as tarefas da semana ficam na
// coluna principal; a atenção e a próxima reunião, na lateral, à vista sem rolar.
// O trabalho é da equipe toda: a tela não divide as tarefas por pessoa (DUVIDAS 4j).

const estadoStatus = { a_fazer: "neutro", fazendo: "info", em_revisao: "alerta", feito: "ok" } as const;

const LIMITE_ATENCAO = 5;

const semResponsavel = (t: TarefaResumo) => t.status !== "feito" && !t.atribuicoes.some((a) => a.papel === "responsavel");

export function VisaoSemana({
  semana,
  tarefas,
  contatosNovos,
  documentosSemana,
  proxima,
  base = "/painel",
}: {
  semana: Semana;
  tarefas: TarefaResumo[];
  contatosNovos: Contato[];
  documentosSemana: { id: string; titulo: string; url: string; tipo: string }[];
  proxima: { id: string | null; data: string | null; atrasadas: number; concluidas: number; contatos: number };
  base?: string;
}) {
  const { semanas, pessoa, podeEditar, avisar } = usePainel();
  const router = useRouter();
  const [criando, iniciar] = useTransition();
  const [verTudo, setVerTudo] = useState(false);
  const daSemana = tarefas.filter((t) => t.semana === semana.numero);
  const feitas = daSemana.filter((t) => t.status === "feito").length;
  const pct = daSemana.length ? Math.round((feitas / daSemana.length) * 100) : 0;
  const entrega = daSemana.filter((t) => t.ligada_entrega);
  const contatosParados = contatosNovos.filter((c) => Date.now() - new Date(c.criado_em).getTime() > 3 * 86400000);
  // cada tarefa aparece uma vez só, com tudo o que há de errado com ela
  const atencao = [
    ...tarefas
      .filter((t) => estaAtrasada(t) || semResponsavel(t))
      .map((t) => {
        const atrasada = estaAtrasada(t);
        return {
          id: `t-${t.id}`,
          href: `/painel/tarefas/${t.id}`,
          manterRolagem: true,
          titulo: t.titulo,
          Icone: atrasada ? AlertTriangle : UserX,
          cor: atrasada ? "text-erro" : "text-alerta",
          detalhe: [atrasada ? textoPrazo(t.prazo!) : null, semResponsavel(t) ? "sem responsável" : null].filter(Boolean).join(" · "),
        };
      }),
    ...contatosParados.map((c) => ({
      id: `c-${c.id}`,
      href: `/painel/contatos?id=${c.id}`,
      manterRolagem: false,
      titulo: c.nome,
      Icone: Inbox,
      cor: "text-info",
      detalhe: `sem resposta desde ${dataCurta(c.criado_em)} · ${pessoa(c.responsavel_id)?.apelido ?? "sem responsável"}`,
    })),
  ];
  const linkEntrega =
    semana.entrega_url ?? documentosSemana.find((d) => d.tipo === "entregavel")?.url ?? null;
  const total = semanas.length;
  const href = (n: number) => (base === "/painel" ? `/painel?semana=${n}` : `/painel/semanas/${n}`);

  // atrasadas primeiro, feitas por último
  const tarefasSemana = [...daSemana].sort(
    (a, b) => Number(estaAtrasada(b)) - Number(estaAtrasada(a)) || Number(a.status === "feito") - Number(b.status === "feito"),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* seletor de semana e progresso */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Botao
            asChild={semana.numero > 1}
            variante="fantasma"
            tamanho="icone"
            className="size-9"
            disabled={semana.numero <= 1}
            aria-label="Semana anterior"
          >
            {semana.numero > 1 ? (
              <Link href={href(semana.numero - 1)}>
                <ArrowLeft aria-hidden />
              </Link>
            ) : (
              <ArrowLeft aria-hidden />
            )}
          </Botao>
          <p className="font-titulo text-[1.125rem] font-semibold text-texto">
            Semana {semana.numero} de {total}
            <span className="t-dado ml-2 text-[0.875rem] font-normal text-texto-2">
              {diaCurto(semana.inicio)} a {diaCurto(semana.fim)}
            </span>
          </p>
          <Botao
            asChild={semana.numero < total}
            variante="fantasma"
            tamanho="icone"
            className="size-9"
            disabled={semana.numero >= total}
            aria-label="Próxima semana"
          >
            {semana.numero < total ? (
              <Link href={href(semana.numero + 1)}>
                <ArrowRight aria-hidden />
              </Link>
            ) : (
              <ArrowRight aria-hidden />
            )}
          </Botao>
        </div>
        <div className="flex min-w-[240px] items-center gap-3">
          <div
            role="progressbar"
            aria-label="Tarefas feitas na semana"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 flex-1 overflow-hidden rounded-full bg-superficie-2"
          >
            <div className="h-full rounded-full bg-caramelo transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="t-dado text-[0.875rem] text-texto-2">
            {feitas}/{daSemana.length} feitas
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:grid-rows-[auto_1fr] xl:items-start">
        {/* 1. entrega do programa */}
        <section aria-labelledby="entrega" className="relative isolate overflow-hidden rounded-g bg-superficie-2 p-5 md:p-6 xl:col-start-1">
          <CurvasDeNivel
            conjunto="rodape"
            className="absolute inset-y-0 right-0 -z-10 hidden h-full w-2/3 text-caramelo/20 [mask-image:linear-gradient(to_left,black,transparent)] md:block"
          />
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="t-rotulo text-link">Entrega do Avança Café</p>
              <h2 id="entrega" className="mt-1.5 font-titulo text-[1.25rem] font-semibold text-texto">
                {semana.entrega_titulo ?? "Sem entrega definida"}
              </h2>
              {semana.entrega_prazo && (
                <p
                  className={cn(
                    "t-dado mt-1 text-[0.875rem]",
                    semana.status === "entregue"
                      ? "text-ok"
                      : diasAtePrazo(semana.entrega_prazo) < 0
                        ? "text-erro"
                        : diasAtePrazo(semana.entrega_prazo) <= 2
                          ? "text-alerta"
                          : "text-texto-2",
                  )}
                >
                  prazo {dataCurta(semana.entrega_prazo)} ·{" "}
                  {semana.status === "entregue" ? "entregue" : textoPrazo(semana.entrega_prazo)}
                </p>
              )}
            </div>
            {linkEntrega && (
              <Botao asChild variante="secundario" tamanho="painel" className="bg-superficie">
                <a href={linkEntrega} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden />
                  Abrir no Drive
                </a>
              </Botao>
            )}
          </div>
          {entrega.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {entrega.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-m bg-superficie px-3 py-2.5">
                  <Chip estado={estadoStatus[t.status]}>{rotuloStatus(t.status).toLowerCase()}</Chip>
                  <Link href={`/painel/tarefas/${t.id}`} scroll={false} className="min-w-0 flex-1 truncate text-texto hover:underline">
                    {t.titulo}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[0.875rem] text-texto-2">
              Nenhuma tarefa ligada à entrega ainda. Marque “Ligada à entrega do programa” numa tarefa da semana.
            </p>
          )}
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:grid-cols-1">
          {/* 2. atenção */}
          <section aria-labelledby="atencao" className="rounded-g border border-linha bg-superficie p-5">
            <h2 id="atencao" className="t-rotulo text-texto-2">
              Atenção {atencao.length > 0 && <span className="t-dado">({atencao.length})</span>}
            </h2>
            {atencao.length === 0 ? (
              <p className="mt-3 text-texto-2">Nada atrasado, tudo com responsável e nenhum contato esperando.</p>
            ) : (
              <>
                <ul className="mt-2 flex flex-col divide-y divide-linha">
                  {(verTudo ? atencao : atencao.slice(0, LIMITE_ATENCAO)).map(({ id, href, manterRolagem, titulo, Icone, cor, detalhe }) => (
                    <li key={id} className="flex gap-3 py-2.5">
                      <Icone aria-hidden strokeWidth={1.75} className={cn("mt-0.5 size-4 shrink-0", cor)} />
                      <div className="min-w-0 flex-1">
                        <Link href={href} scroll={!manterRolagem} className="block truncate text-texto hover:underline">
                          {titulo}
                        </Link>
                        <p className={cn("t-dado text-[0.8125rem]", cor)}>{detalhe}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {atencao.length > LIMITE_ATENCAO && (
                  <button type="button" onClick={() => setVerTudo(!verTudo)} className="link mt-1 text-[0.875rem]">
                    {verTudo ? "Ver menos" : `Ver todos (${atencao.length})`}
                  </button>
                )}
              </>
            )}
          </section>

          {/* 3. próxima reunião */}
          <section aria-labelledby="reuniao" className="rounded-g border border-linha bg-superficie p-5">
            <h2 id="reuniao" className="t-rotulo text-texto-2">
              Próxima reunião
            </h2>
            {proxima.data ? (
              <>
                <p className="mt-3 flex items-center gap-2 font-titulo text-[1.0625rem] font-semibold text-texto first-letter:uppercase">
                  <CalendarClock aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0 text-caramelo" />
                  {dataLonga(proxima.data)}
                </p>
                <ul className="mt-3 space-y-1 text-[0.875rem] text-texto-2">
                  <li>Entrega da semana: {semana.entrega_titulo ?? "não definida"}</li>
                  <li>
                    <span className="t-dado">{proxima.atrasadas}</span> tarefas atrasadas
                  </li>
                  <li>
                    <span className="t-dado">{proxima.concluidas}</span> concluídas desde a última reunião
                  </li>
                  <li>
                    <span className="t-dado">{proxima.contatos}</span> contatos novos
                  </li>
                </ul>
                <div className="mt-4">
                  {proxima.id ? (
                    <Botao asChild variante="secundario" tamanho="painel">
                      <Link href={`/painel/reunioes/${proxima.id}`}>Abrir pauta</Link>
                    </Botao>
                  ) : (
                    podeEditar && (
                      <Botao
                        variante="secundario"
                        tamanho="painel"
                        disabled={criando}
                        onClick={() =>
                          iniciar(async () => {
                            const r = await criarReuniao(proxima.data!);
                            if (r.ok && r.dado) router.push(`/painel/reunioes/${r.dado}`);
                            else if (!r.ok) avisar(r.erro, { erro: true });
                          })
                        }
                      >
                        Abrir pauta
                      </Botao>
                    )
                  )}
                </div>
              </>
            ) : (
              <EstadoVazio
                texto="Defina o dia e o horário da reunião semanal em Configurações para ver a pauta aqui."
                acao={
                  <Botao asChild variante="secundario" tamanho="painel">
                    <Link href="/painel/reunioes">Ver reuniões</Link>
                  </Botao>
                }
              />
            )}
          </section>
        </div>

        {/* 4. tarefas da semana */}
        <section aria-labelledby="tarefas-semana" className="xl:col-start-1 xl:row-start-2">
          <h2 id="tarefas-semana" className="t-rotulo mb-3 text-texto-2">
            Tarefas da semana
          </h2>
          {tarefasSemana.length ? (
            <div className="columns-[260px] gap-3">
              {tarefasSemana.map((t) => (
                <CartaoTarefa key={t.id} tarefa={t} comItens className="mb-3 break-inside-avoid" />
              ))}
            </div>
          ) : (
            <p className="text-[0.875rem] text-texto-2">Nenhuma tarefa nesta semana.</p>
          )}
        </section>
      </div>
    </div>
  );
}
