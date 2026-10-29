"use client";

import { Check, Copy, KeyRound, Monitor, Moon, Sun, Upload } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { atualizarConfiguracao, criarToken, importarTrello, recalcularSemanas, revogarToken } from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { estiloControle } from "@/components/ui/campo";
import { Chip } from "@/components/ui/chip";
import { dataHora } from "@/lib/painel/datas";
import type { Configuracao, TokenApi } from "@/lib/painel/tipos";
import { aplicarTema, CHAVE_TEMA, type Tema } from "@/lib/tema";
import { enxugar, planejarImportacao, type PlanoImportacao, type TrelloJson } from "@/lib/painel/trello";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";

// Configurações (seção 9.9, só admin).

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function Bloco({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-linha py-7 first:pt-0 md:grid-cols-[260px_1fr] md:gap-8">
      <div>
        <h2 className="font-titulo text-[1.0625rem] font-semibold text-texto">{titulo}</h2>
        {descricao && <p className="mt-1 text-[0.875rem] text-texto-2">{descricao}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function PaginaConfiguracoes({ config, tokens, siteUrl }: { config: Configuracao; tokens: TokenApi[]; siteUrl: string }) {
  const { ativas, semanas, etiquetas, pessoas, avisar } = usePainel();
  const [pendente, iniciar] = useTransition();
  const [c, setC] = useState(config);
  const [inicio, setInicio] = useState(semanas[0]?.inicio ?? "");
  const [nomeToken, setNomeToken] = useState("Claude do projeto");
  const [tokenNovo, setTokenNovo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [plano, setPlano] = useState<PlanoImportacao | null>(null);
  const [json, setJson] = useState<TrelloJson | null>(null);
  const [tema, setTema] = useState<Tema>("sistema");
  useEffect(() => {
    try {
      const t = localStorage.getItem(CHAVE_TEMA);
      setTema(t === "claro" || t === "escuro" ? t : "sistema");
    } catch {}
  }, []);

  const rodar = <T,>(fn: () => Promise<{ ok: true; dado?: T } | { ok: false; erro: string }>, ok?: string, depois?: (d?: T) => void) =>
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) avisar(r.erro, { erro: true });
      else {
        if (ok) avisar(ok);
        depois?.(r.dado);
      }
    });

  const campo = cn(estiloControle, "h-10");

  return (
    <div className="flex flex-col">
      <Bloco titulo="Reunião semanal" descricao="Usada para criar a próxima reunião e montar a pauta.">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            <span className="text-[0.875rem] font-semibold">Dia</span>
            <select
              className={cn(campo, "w-auto")}
              value={c.reuniao_dia_semana ?? ""}
              onChange={(e) => setC({ ...c, reuniao_dia_semana: e.target.value === "" ? null : Number(e.target.value) })}
            >
              <option value="">Não definido</option>
              {DIAS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[0.875rem] font-semibold">Horário</span>
            <input type="time" className={cn(campo, "w-auto")} value={c.reuniao_hora ?? ""} onChange={(e) => setC({ ...c, reuniao_hora: e.target.value || null })} />
          </label>
        </div>
      </Bloco>

      <Bloco titulo="Contatos do site" descricao="Quem recebe a tarefa “Responder contato” quando alguém escreve pelo site.">
        <select
          className={cn(campo, "w-auto")}
          value={c.responsavel_contato_id ?? ""}
          onChange={(e) => setC({ ...c, responsavel_contato_id: e.target.value || null })}
        >
          <option value="">Ninguém</option>
          {ativas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <div className="mt-4">
          <Botao tamanho="painel" disabled={pendente} onClick={() => rodar(() => atualizarConfiguracao(c), "Configurações salvas.")}>
            Salvar reunião e contatos
          </Botao>
        </div>
      </Bloco>

      <Bloco titulo="Datas do programa" descricao="Muda o início da semana 1 e recalcula as 12 semanas (7 dias cada). Depois dá para ajustar cada semana na página dela.">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            <span className="text-[0.875rem] font-semibold">Início da semana 1</span>
            <input type="date" className={cn(campo, "w-auto")} value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <Botao
            variante="secundario"
            tamanho="painel"
            disabled={pendente || !inicio}
            onClick={() => rodar(() => recalcularSemanas(inicio), "Semanas recalculadas.")}
          >
            Recalcular as 12 semanas
          </Botao>
        </div>
      </Bloco>

      <Bloco titulo="Tokens da API do Claude" descricao="O Claude usa um token para criar e atribuir tarefas pela API e pelo conector MCP. O token aparece uma única vez.">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            rodar(() => criarToken(nomeToken), undefined, (t) => {
              setTokenNovo(t ?? null);
              setCopiado(false);
            });
          }}
        >
          <input className={cn(campo, "w-64")} value={nomeToken} onChange={(e) => setNomeToken(e.target.value)} aria-label="Nome do token" />
          <Botao type="submit" tamanho="painel" disabled={pendente}>
            <KeyRound aria-hidden /> Criar token
          </Botao>
        </form>
        {tokenNovo && (
          <div className="mt-4 rounded-m border border-alerta/40 bg-alerta-fundo p-4">
            <p className="text-[0.875rem] font-semibold text-alerta">Copie agora: este token não aparece de novo.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="t-dado min-w-0 flex-1 truncate rounded-p bg-superficie px-3 py-2 text-[0.8125rem] text-texto">{tokenNovo}</code>
              <Botao
                variante="secundario"
                tamanho="painel"
                onClick={() => {
                  navigator.clipboard?.writeText(tokenNovo);
                  setCopiado(true);
                }}
              >
                {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copiado ? "Copiado" : "Copiar"}
              </Botao>
            </div>
            <p className="t-pequeno mt-3 text-texto-2">
              Conector MCP: <code className="t-dado">{siteUrl}/api/mcp</code> · API: <code className="t-dado">{siteUrl}/api/v1</code> · cabeçalho{" "}
              <code className="t-dado">Authorization: Bearer &lt;token&gt;</code>
            </p>
          </div>
        )}
        <ul className="mt-4 flex flex-col divide-y divide-linha rounded-m border border-linha bg-superficie">
          {tokens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="font-medium text-texto">{t.nome}</span>
              <span className="t-dado text-[0.8125rem] text-texto-2">criado {dataHora(t.criado_em)}</span>
              <span className="t-dado text-[0.8125rem] text-texto-2">{t.ultimo_uso ? `último uso ${dataHora(t.ultimo_uso)}` : "nunca usado"}</span>
              <span className="ml-auto">
                {t.revogado ? (
                  <Chip estado="neutro">revogado</Chip>
                ) : (
                  <Botao variante="fantasma" tamanho="painel" className="text-erro" onClick={() => rodar(() => revogarToken(t.id), "Token revogado.")}>
                    Revogar
                  </Botao>
                )}
              </span>
            </li>
          ))}
          {tokens.length === 0 && <li className="px-4 py-3 text-[0.875rem] text-texto-2">Nenhum token criado.</li>}
        </ul>
      </Bloco>

      <Bloco titulo="Importar do Trello" descricao="No Trello: menu do quadro › Imprimir, exportar e compartilhar › Exportar como JSON. Reimportar não duplica tarefas.">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-m border border-texto px-3.5 py-2 text-[0.9375rem] font-semibold text-texto hover:bg-superficie-2">
          <Upload aria-hidden strokeWidth={1.75} className="size-[18px]" />
          Escolher arquivo JSON
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const arquivo = e.target.files?.[0];
              if (!arquivo) return;
              try {
                const j = enxugar(JSON.parse(await arquivo.text()));
                setJson(j);
                setPlano(planejarImportacao(j, pessoas.filter((p) => p.ativo), etiquetas, semanas));
              } catch {
                avisar("Esse arquivo não parece ser um JSON exportado do Trello.", { erro: true });
              }
            }}
          />
        </label>
        {plano && json && (
          <div className="mt-4 rounded-m border border-linha bg-superficie p-4">
            <p className="text-texto">
              <span className="t-dado">{plano.totais.tarefas}</span> tarefas, <span className="t-dado">{plano.totais.itens}</span> itens,{" "}
              <span className="t-dado">{plano.totais.documentos}</span> documentos
              {plano.checklistsSemPessoa.length > 0 && (
                <>
                  ; <span className="t-dado">{plano.checklistsSemPessoa.length}</span> checklists sem pessoa reconhecida
                </>
              )}
              .
            </p>
            {plano.checklistsSemPessoa.length > 0 && (
              <ul className="t-pequeno mt-2 list-disc pl-5 text-texto-2">
                {plano.checklistsSemPessoa.slice(0, 8).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              <Botao
                tamanho="painel"
                disabled={pendente}
                onClick={() =>
                  rodar(() => importarTrello(json), undefined, (r) => {
                    avisar(`Importação concluída: ${r?.criadas ?? 0} tarefas criadas${r?.puladas ? `, ${r.puladas} já existiam` : ""}.`);
                    setPlano(null);
                    setJson(null);
                  })
                }
              >
                Confirmar importação
              </Botao>
              <Botao variante="fantasma" tamanho="painel" onClick={() => setPlano(null)}>
                Cancelar
              </Botao>
            </div>
          </div>
        )}
      </Bloco>

      <Bloco titulo="Tema" descricao="Vale só para este navegador. Também fica no menu da sua conta.">
        <div className="flex gap-2">
          {(
            [
              ["claro", "Claro", Sun],
              ["escuro", "Escuro", Moon],
              ["sistema", "Sistema", Monitor],
            ] as const
          ).map(([v, r, I]) => (
            <button
              key={v}
              type="button"
              aria-pressed={tema === v}
              onClick={() => {
                aplicarTema(v);
                setTema(v);
              }}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-m border px-4 text-[0.9375rem]",
                tema === v ? "border-texto bg-superficie-2 font-semibold text-texto" : "border-linha text-texto-2 hover:bg-superficie-2",
              )}
            >
              <I aria-hidden strokeWidth={1.75} className="size-4" />
              {r}
            </button>
          ))}
        </div>
      </Bloco>
    </div>
  );
}
