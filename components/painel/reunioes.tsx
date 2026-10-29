"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, Flag, Inbox, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adicionarDecisao, alternarPresenca, atualizarReuniao, criarReuniao, removerDecisao } from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { estiloControle } from "@/components/ui/campo";
import { Chip } from "@/components/ui/chip";
import { dataLonga, dataCurta, dataHora, textoPrazo } from "@/lib/painel/datas";
import type { Pauta } from "@/lib/painel/pauta";
import { rotuloStatus, type Reuniao, type TarefaResumo } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { Avatar, EstadoVazio, PilhaAvatares } from "./elementos";
import { Markdown } from "./markdown";
import { DialogoNovaTarefa } from "./nova-tarefa";

// Reuniões (seção 9.6): lista, pauta gerada em 4 blocos, anotações, decisões,
// tarefas criadas na reunião e link da ata.

export function ListaReunioes({ reunioes }: { reunioes: Reuniao[] }) {
  const { pessoa, podeEditar, avisar } = usePainel();
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const agora = Date.now();
  const nova = () =>
    iniciar(async () => {
      const r = await criarReuniao();
      if (!r.ok) avisar(r.erro, { erro: true });
      else if (r.dado) router.push(`/painel/reunioes/${r.dado}`);
    });

  return (
    <div className="flex flex-col gap-5">
      {podeEditar && (
        <div>
          <Botao variante="secundario" tamanho="painel" onClick={nova} disabled={pendente}>
            <Plus aria-hidden /> Nova reunião
          </Botao>
        </div>
      )}
      {reunioes.length === 0 ? (
        <EstadoVazio texto="As reuniões da equipe aparecem aqui, com pauta, decisões e tarefas criadas." />
      ) : (
        <ul className="flex flex-col divide-y divide-linha rounded-m border border-linha bg-superficie">
          {reunioes.map((r) => {
            const futura = new Date(r.data).getTime() > agora;
            return (
              <li key={r.id} className="relative flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3.5 hover:bg-superficie-2/50">
                <Link
                  href={`/painel/reunioes/${r.id}`}
                  className="min-w-56 flex-1 font-medium text-texto first-letter:uppercase after:absolute after:inset-0 hover:underline"
                >
                  {dataLonga(r.data)}
                </Link>
                {futura && <Chip estado="info">próxima</Chip>}
                <PilhaAvatares pessoas={r.presentes.map((id) => pessoa(id))} />
                <span className="t-dado text-[0.8125rem] text-texto-2">
                  {r.decisoes.length} {r.decisoes.length === 1 ? "decisão" : "decisões"}
                </span>
                {r.ata_url ? (
                  <a href={r.ata_url} target="_blank" rel="noreferrer" className="link relative z-10 inline-flex items-center gap-1 text-[0.875rem]">
                    Ata <ExternalLink aria-hidden strokeWidth={1.75} className="size-3.5" />
                  </a>
                ) : (
                  <span className="text-[0.875rem] text-texto-2">sem ata</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LinhaPauta({ t, extra }: { t: TarefaResumo; extra?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <Link href={`/painel/tarefas/${t.id}`} className="min-w-0 flex-1 truncate text-texto hover:underline">
        {t.titulo}
      </Link>
      {extra}
    </li>
  );
}

export function PaginaReuniao({ reuniao: r, pauta, criadas }: { reuniao: Reuniao; pauta: Pauta; criadas: TarefaResumo[] }) {
  const { ativas, pessoa, podeEditar, avisar } = usePainel();
  const [pendente, iniciar] = useTransition();
  const [anotacoes, setAnotacoes] = useState(r.anotacoes ?? "");
  const [editando, setEditando] = useState(false);
  const [decisao, setDecisao] = useState("");
  const [ata, setAta] = useState(r.ata_url ?? "");
  const [nova, setNova] = useState(false);
  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok?: string) =>
    iniciar(async () => {
      const x = await fn();
      if (!x.ok) avisar(x.erro ?? "Algo deu errado.", { erro: true });
      else if (ok) avisar(ok);
    });

  const bloco = "rounded-g border border-linha bg-superficie p-5";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <section aria-labelledby="pauta" className={bloco}>
          <h2 id="pauta" className="t-rotulo text-texto-2">
            Pauta gerada
          </h2>
          <ol className="mt-4 flex flex-col gap-5">
            <li>
              <h3 className="flex items-center gap-2 font-semibold text-texto">
                <Flag aria-hidden strokeWidth={1.75} className="size-4 text-caramelo" /> 1. Entrega do programa
                {pauta.semana && <span className="t-dado text-[0.8125rem] font-normal text-texto-2">semana {pauta.semana.numero}</span>}
              </h3>
              <p className="mt-1 text-[0.9375rem] text-texto">{pauta.semana?.entrega_titulo ?? "Sem entrega definida."}</p>
              {pauta.semana?.entrega_prazo && (
                <p className="t-dado text-[0.8125rem] text-texto-2">
                  prazo {dataCurta(pauta.semana.entrega_prazo)} · {textoPrazo(pauta.semana.entrega_prazo)}
                </p>
              )}
              <ul className="mt-1.5">
                {pauta.entrega.map((t) => (
                  <LinhaPauta key={t.id} t={t} extra={<span className="text-[0.8125rem] text-texto-2">{rotuloStatus(t.status).toLowerCase()}</span>} />
                ))}
              </ul>
            </li>
            <li>
              <h3 className="flex items-center gap-2 font-semibold text-texto">
                <AlertTriangle aria-hidden strokeWidth={1.75} className="size-4 text-erro" /> 2. Tarefas atrasadas
                <span className="t-dado text-[0.8125rem] font-normal text-texto-2">{pauta.atrasadas.length}</span>
              </h3>
              <ul className="mt-1.5">
                {pauta.atrasadas.length ? (
                  pauta.atrasadas.map((t) => (
                    <LinhaPauta
                      key={t.id}
                      t={t}
                      extra={
                        <>
                          <PilhaAvatares pessoas={t.atribuicoes.filter((a) => a.papel === "responsavel").map((a) => pessoa(a.pessoa_id))} />
                          <span className="t-dado text-[0.8125rem] text-erro">{textoPrazo(t.prazo!)}</span>
                        </>
                      }
                    />
                  ))
                ) : (
                  <li className="text-[0.875rem] text-texto-2">Nenhuma.</li>
                )}
              </ul>
            </li>
            <li>
              <h3 className="flex items-center gap-2 font-semibold text-texto">
                <CheckCircle2 aria-hidden strokeWidth={1.75} className="size-4 text-ok" /> 3. Concluídas desde a última reunião
                <span className="t-dado text-[0.8125rem] font-normal text-texto-2">{pauta.concluidas.length}</span>
              </h3>
              <ul className="mt-1.5">
                {pauta.concluidas.length ? (
                  pauta.concluidas.map((t) => <LinhaPauta key={t.id} t={t} extra={<span className="t-dado text-[0.8125rem] text-texto-2">{dataCurta(t.concluido_em!)}</span>} />)
                ) : (
                  <li className="text-[0.875rem] text-texto-2">Nenhuma.</li>
                )}
              </ul>
            </li>
            <li>
              <h3 className="flex items-center gap-2 font-semibold text-texto">
                <Inbox aria-hidden strokeWidth={1.75} className="size-4 text-info" /> 4. Contatos novos
                <span className="t-dado text-[0.8125rem] font-normal text-texto-2">{pauta.contatosNovos.length}</span>
              </h3>
              <ul className="mt-1.5">
                {pauta.contatosNovos.length ? (
                  pauta.contatosNovos.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-1.5">
                      <Link href={`/painel/contatos?id=${c.id}`} className="min-w-0 flex-1 truncate text-texto hover:underline">
                        {c.nome}
                      </Link>
                      <span className="text-[0.8125rem] text-texto-2">
                        {c.cidade_uf ?? ""} · {dataCurta(c.criado_em)}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-[0.875rem] text-texto-2">Nenhum.</li>
                )}
              </ul>
            </li>
          </ol>
        </section>

        <section aria-labelledby="anotacoes-reuniao" className={bloco}>
          <div className="flex items-center justify-between">
            <h2 id="anotacoes-reuniao" className="t-rotulo text-texto-2">
              Anotações
            </h2>
            {podeEditar && !editando && (
              <button type="button" onClick={() => setEditando(true)} className="link text-[0.875rem]">
                {r.anotacoes ? "Editar" : "Escrever"}
              </button>
            )}
          </div>
          {editando ? (
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                autoFocus
                value={anotacoes}
                onChange={(e) => setAnotacoes(e.target.value)}
                rows={12}
                placeholder="O que foi conversado. Aceita Markdown."
                className={cn(estiloControle, "py-2 leading-relaxed")}
              />
              <div className="flex justify-end gap-2">
                <Botao variante="fantasma" tamanho="painel" onClick={() => setEditando(false)}>
                  Cancelar
                </Botao>
                <Botao
                  tamanho="painel"
                  disabled={pendente}
                  onClick={() => {
                    rodar(() => atualizarReuniao(r.id, { anotacoes }), "Anotações salvas.");
                    setEditando(false);
                  }}
                >
                  Salvar anotações
                </Botao>
              </div>
            </div>
          ) : r.anotacoes ? (
            <Markdown texto={r.anotacoes} className="mt-3" />
          ) : (
            <p className="mt-3 text-[0.875rem] text-texto-2">Sem anotações ainda.</p>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-6">
        <section aria-labelledby="presenca" className={bloco}>
          <h2 id="presenca" className="t-rotulo text-texto-2">
            Presentes
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {ativas.map((p) => {
              const presente = r.presentes.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={!podeEditar}
                    aria-pressed={presente}
                    onClick={() => rodar(() => alternarPresenca(r.id, p.id, !presente))}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full border pr-3 pl-1 text-[0.875rem]",
                      presente ? "border-texto bg-superficie-2 font-semibold text-texto" : "border-linha text-texto-2 opacity-70",
                    )}
                  >
                    <Avatar pessoa={p} tamanho={28} titulo={false} />
                    {p.apelido ?? p.nome}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="decisoes" className={bloco}>
          <h2 id="decisoes" className="t-rotulo text-texto-2">
            Decisões
          </h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {r.decisoes.map((d) => (
              <li key={d.id} className="group flex items-start gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-caramelo" />
                <span className="flex-1 text-texto">{d.texto}</span>
                {podeEditar && (
                  <button
                    type="button"
                    aria-label="Apagar decisão"
                    onClick={() => rodar(() => removerDecisao(d.id))}
                    className="rounded-p p-1 text-texto-2 opacity-0 group-hover:opacity-100 hover:text-erro focus-visible:opacity-100"
                  >
                    <Trash2 aria-hidden strokeWidth={1.75} className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
            {r.decisoes.length === 0 && <li className="text-[0.875rem] text-texto-2">Nenhuma decisão registrada.</li>}
          </ul>
          {podeEditar && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!decisao.trim()) return;
                const t = decisao;
                setDecisao("");
                rodar(() => adicionarDecisao(r.id, t));
              }}
            >
              <input
                value={decisao}
                onChange={(e) => setDecisao(e.target.value)}
                placeholder="Nova decisão"
                aria-label="Nova decisão"
                className={cn(estiloControle, "h-9")}
              />
              <Botao type="submit" variante="secundario" tamanho="painel">
                Adicionar
              </Botao>
            </form>
          )}
        </section>

        <section aria-labelledby="criadas" className={bloco}>
          <div className="flex items-center justify-between">
            <h2 id="criadas" className="t-rotulo text-texto-2">
              Tarefas criadas nesta reunião
            </h2>
            {podeEditar && (
              <Botao variante="fantasma" tamanho="painel" onClick={() => setNova(true)}>
                <Plus aria-hidden /> Nova tarefa
              </Botao>
            )}
          </div>
          <ul className="mt-2">
            {criadas.map((t) => (
              <LinhaPauta
                key={t.id}
                t={t}
                extra={<PilhaAvatares pessoas={t.atribuicoes.map((a) => pessoa(a.pessoa_id))} />}
              />
            ))}
            {criadas.length === 0 && <li className="text-[0.875rem] text-texto-2">Nenhuma ainda.</li>}
          </ul>
          {podeEditar && <DialogoNovaTarefa aberto={nova} aoMudar={setNova} reuniaoId={r.id} />}
        </section>

        <section aria-labelledby="ata" className={bloco}>
          <h2 id="ata" className="t-rotulo text-texto-2">
            Ata no Drive
          </h2>
          {podeEditar ? (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                rodar(() => atualizarReuniao(r.id, { ata_url: ata || null }), "Link da ata salvo.");
              }}
            >
              <input
                value={ata}
                onChange={(e) => setAta(e.target.value)}
                placeholder="https://docs.google.com/…"
                aria-label="Link da ata"
                className={cn(estiloControle, "h-9")}
              />
              <Botao type="submit" variante="secundario" tamanho="painel">
                Salvar
              </Botao>
            </form>
          ) : r.ata_url ? (
            <a href={r.ata_url} className="link mt-3 inline-block" target="_blank" rel="noreferrer">
              Abrir a ata
            </a>
          ) : (
            <p className="mt-3 text-[0.875rem] text-texto-2">Sem ata.</p>
          )}
          <p className="t-pequeno mt-3 text-texto-2">Reunião de {dataHora(r.data)}.</p>
        </section>
      </div>
    </div>
  );
}
