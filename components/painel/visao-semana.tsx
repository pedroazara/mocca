"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, ExternalLink, Inbox, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { criarReuniao } from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { dataCurta, dataLonga, diaCurto, diasAtePrazo, estaAtrasada, textoPrazo } from "@/lib/painel/datas";
import type { Contato, Semana, TarefaResumo } from "@/lib/painel/tipos";
import { rotuloStatus } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { Avatar, EstadoVazio } from "./elementos";
import { CartaoTarefa } from "./tarefa-pecas";

// Tela "Semana" (seção 9.1): em 10 segundos, o que a equipe precisa entregar
// nesta semana e quem está atrasado.

const estadoStatus = { a_fazer: "neutro", fazendo: "info", em_revisao: "alerta", feito: "ok" } as const;

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
  const { semanas, ativas, pessoa, podeEditar, avisar } = usePainel();
  const router = useRouter();
  const [criando, iniciar] = useTransition();
  const daSemana = tarefas.filter((t) => t.semana === semana.numero);
  const feitas = daSemana.filter((t) => t.status === "feito").length;
  const pct = daSemana.length ? Math.round((feitas / daSemana.length) * 100) : 0;
  const entrega = daSemana.filter((t) => t.ligada_entrega);
  const atrasadas = tarefas.filter((t) => estaAtrasada(t));
  const semResponsavel = tarefas.filter(
    (t) => t.status !== "feito" && !t.atribuicoes.some((a) => a.papel === "responsavel"),
  );
  const contatosParados = contatosNovos.filter((c) => Date.now() - new Date(c.criado_em).getTime() > 3 * 86400000);
  const linkEntrega =
    semana.entrega_url ?? documentosSemana.find((d) => d.tipo === "entregavel")?.url ?? null;
  const total = semanas.length;
  const href = (n: number) => (base === "/painel" ? `/painel?semana=${n}` : `/painel/semanas/${n}`);

  const colunas = ativas
    .filter((p) => p.papel !== "orientador" || daSemana.some((t) => t.atribuicoes.some((a) => a.pessoa_id === p.id)))
    .map((p) => {
      const minhas = daSemana
        .filter((t) => t.atribuicoes.some((a) => a.pessoa_id === p.id))
        .sort((a, b) => Number(estaAtrasada(b)) - Number(estaAtrasada(a)) || Number(a.status === "feito") - Number(b.status === "feito"));
      return { p, minhas, feitas: minhas.filter((t) => t.status === "feito").length };
    });

  return (
    <div className="flex flex-col gap-8">
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

      {/* 1. entrega do programa */}
      <section aria-labelledby="entrega" className="rounded-g bg-superficie-2 p-5 md:p-6">
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
            <Botao asChild variante="secundario" tamanho="painel">
              <a href={linkEntrega} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden />
                Abrir no Drive
              </a>
            </Botao>
          )}
        </div>
        {entrega.length > 0 ? (
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {entrega.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-m bg-superficie px-3 py-2.5">
                <Chip estado={estadoStatus[t.status]}>{rotuloStatus(t.status).toLowerCase()}</Chip>
                <Link href={`/painel/tarefas/${t.id}`} className="min-w-0 flex-1 truncate text-texto hover:underline">
                  {t.titulo}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[0.875rem] text-texto-2">
            Nenhuma tarefa ligada à entrega ainda. Marque "Ligada à entrega do programa" numa tarefa da semana.
          </p>
        )}
      </section>

      {/* 2. por pessoa */}
      <section aria-labelledby="por-pessoa">
        <h2 id="por-pessoa" className="t-rotulo mb-3 text-texto-2">
          Por pessoa
        </h2>
        <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:-mx-8 lg:px-8">
          <div className="flex gap-4">
            {colunas.map(({ p, minhas, feitas: f }) => (
              <div key={p.id} className="w-[280px] shrink-0">
                <div className="mb-3 flex items-center gap-2.5">
                  <Avatar pessoa={p} tamanho={28} />
                  <span className="flex-1 truncate font-semibold text-texto">{p.apelido ?? p.nome}</span>
                  <span className="t-dado text-[0.8125rem] text-texto-2">
                    {f} de {minhas.length} feitas
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {minhas.length ? (
                    minhas.map((t) => <CartaoTarefa key={t.id} tarefa={t} itensDe={p.id} />)
                  ) : (
                    <p className="rounded-m border border-dashed border-linha px-3 py-6 text-center text-[0.875rem] text-texto-2">
                      Nada nesta semana.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* 3. atenção */}
        <section aria-labelledby="atencao" className="rounded-g border border-linha bg-superficie p-5">
          <h2 id="atencao" className="t-rotulo text-texto-2">
            Atenção
          </h2>
          {atrasadas.length + semResponsavel.length + contatosParados.length === 0 ? (
            <p className="mt-3 text-texto-2">Nada atrasado, tudo com responsável e nenhum contato esperando.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-linha">
              {atrasadas.map((t) => (
                <li key={`a-${t.id}`} className="flex items-center gap-3 py-2.5">
                  <AlertTriangle aria-label="Atrasada" strokeWidth={1.75} className="size-4 shrink-0 text-erro" />
                  <Link href={`/painel/tarefas/${t.id}`} className="min-w-0 flex-1 truncate text-texto hover:underline">
                    {t.titulo}
                  </Link>
                  <span className="t-dado shrink-0 text-[0.8125rem] text-erro">{textoPrazo(t.prazo!)}</span>
                </li>
              ))}
              {semResponsavel.map((t) => (
                <li key={`r-${t.id}`} className="flex items-center gap-3 py-2.5">
                  <UserX aria-label="Sem responsável" strokeWidth={1.75} className="size-4 shrink-0 text-alerta" />
                  <Link href={`/painel/tarefas/${t.id}`} className="min-w-0 flex-1 truncate text-texto hover:underline">
                    {t.titulo}
                  </Link>
                  <span className="shrink-0 text-[0.8125rem] text-alerta">sem responsável</span>
                </li>
              ))}
              {contatosParados.map((c) => (
                <li key={`c-${c.id}`} className="flex items-center gap-3 py-2.5">
                  <Inbox aria-label="Contato sem resposta" strokeWidth={1.75} className="size-4 shrink-0 text-info" />
                  <Link href={`/painel/contatos?id=${c.id}`} className="min-w-0 flex-1 truncate text-texto hover:underline">
                    {c.nome}
                  </Link>
                  <span className="shrink-0 text-[0.8125rem] text-texto-2">
                    sem resposta desde {dataCurta(c.criado_em)} · {pessoa(c.responsavel_id)?.apelido ?? "sem responsável"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 4. próxima reunião */}
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
    </div>
  );
}
