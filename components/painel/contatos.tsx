"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Download, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { atualizarContato } from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { estiloControle } from "@/components/ui/campo";
import { Chip } from "@/components/ui/chip";
import { dataCurta, dataHora } from "@/lib/painel/datas";
import { PERFIS_CONTATO, STATUS_CONTATO, type Contato, type StatusContato } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { Avatar, EstadoVazio } from "./elementos";

// Contatos do site (seção 9.7). O orientador vê, mas não edita.

const estadoContato = { novo: "info", em_conversa: "alerta", respondido: "ok", arquivado: "neutro" } as const;
const rotuloStatusContato = (s: StatusContato) => STATUS_CONTATO.find((x) => x.valor === s)?.rotulo ?? s;

export function TabelaContatos({ contatos, aberto }: { contatos: Contato[]; aberto: Contato | null }) {
  const { pessoa } = usePainel();
  const params = useSearchParams();
  const caminho = usePathname();
  const router = useRouter();

  const mudar = (chave: string, valor: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (!valor) p.delete(chave);
    else p.set(chave, valor);
    router.replace(`${caminho}${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };
  const csv = new URLSearchParams();
  if (params.get("perfil")) csv.set("perfil", params.get("perfil")!);
  if (params.get("status")) csv.set("status", params.get("status")!);
  const controle = cn(estiloControle, "h-9 w-auto");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Perfil" value={params.get("perfil") ?? ""} onChange={(e) => mudar("perfil", e.target.value)} className={controle}>
          <option value="">Todos os perfis</option>
          {Object.entries(PERFIS_CONTATO).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={params.get("status") ?? ""} onChange={(e) => mudar("status", e.target.value)} className={controle}>
          <option value="">Todos os status</option>
          {STATUS_CONTATO.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.rotulo}
            </option>
          ))}
        </select>
        <Botao asChild variante="secundario" tamanho="painel" className="ml-auto">
          <a href={`/painel/contatos/exportar${csv.toString() ? `?${csv}` : ""}`}>
            <Download aria-hidden /> Exportar CSV
          </a>
        </Botao>
      </div>

      {contatos.length === 0 ? (
        <EstadoVazio texto="Os contatos enviados pelo formulário do site aparecem aqui, cada um com uma tarefa para responder." />
      ) : (
        <div className="overflow-x-auto rounded-m border border-linha bg-superficie">
          <table className="w-full min-w-[820px] text-left text-[0.9375rem]">
            <thead className="bg-superficie-2">
              <tr className="t-rotulo text-texto-2">
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Perfil</th>
                <th className="px-4 py-2.5 font-medium">Cidade/UF</th>
                <th className="px-4 py-2.5 text-right font-medium">Área (ha)</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {contatos.map((c) => {
                const resp = pessoa(c.responsavel_id);
                return (
                  <tr key={c.id} className="relative hover:bg-superficie-2/50">
                    <td className="t-dado px-4 py-3 text-[0.8125rem] text-texto-2">{dataCurta(c.criado_em)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => mudar("id", c.id)}
                        className="text-left font-medium text-texto after:absolute after:inset-0 hover:underline"
                      >
                        {c.nome}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-texto-2">{PERFIS_CONTATO[c.perfil]}</td>
                    <td className="px-4 py-3 text-texto-2">{c.cidade_uf ?? "–"}</td>
                    <td className="t-dado px-4 py-3 text-right text-texto-2">{c.area_ha ?? "–"}</td>
                    <td className="px-4 py-3">
                      <Chip estado={estadoContato[c.status]}>{rotuloStatusContato(c.status)}</Chip>
                    </td>
                    <td className="px-4 py-3">
                      {resp ? (
                        <span className="flex items-center gap-2 text-texto-2">
                          <Avatar pessoa={resp} tamanho={20} />
                          {resp.apelido ?? resp.nome}
                        </span>
                      ) : (
                        <span className="text-texto-2">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {aberto && <PainelContato key={aberto.id + aberto.status + (aberto.notas ?? "")} contato={aberto} aoFechar={() => mudar("id", null)} />}
    </div>
  );
}

function PainelContato({ contato: c, aoFechar }: { contato: Contato; aoFechar: () => void }) {
  const { podeEditar, ativas, avisar } = usePainel();
  const [pendente, iniciar] = useTransition();
  const [notas, setNotas] = useState(c.notas ?? "");
  const salvar = (campos: Parameters<typeof atualizarContato>[1], ok?: string) =>
    iniciar(async () => {
      const r = await atualizarContato(c.id, campos);
      if (!r.ok) avisar(r.erro, { erro: true });
      else if (ok) avisar(ok);
    });
  const linha = "grid grid-cols-[120px_1fr] gap-3 py-1.5 text-[0.9375rem]";

  return (
    <Dialog.Root open onOpenChange={(a) => !a && aoFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-texto/20" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-linha bg-fundo shadow-flutuante data-[state=open]:animate-[painel-entra_200ms_ease-out] sm:w-[560px]"
        >
          <div className="flex h-12 shrink-0 items-center justify-end border-b border-linha px-3">
            <Dialog.Close aria-label="Fechar" className="rounded-p p-2 text-texto-2 hover:bg-superficie-2 hover:text-texto">
              <X aria-hidden strokeWidth={1.75} className="size-[18px]" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pt-5 pb-10">
            <Dialog.Title className="font-titulo text-[1.375rem] font-semibold text-texto">{c.nome}</Dialog.Title>
            <p className="t-dado mt-1 text-[0.8125rem] text-texto-2">recebido em {dataHora(c.criado_em)}</p>

            <div className="mt-5 flex flex-wrap gap-3">
              <select
                aria-label="Status"
                value={c.status}
                disabled={!podeEditar || pendente}
                onChange={(e) => salvar({ status: e.target.value as StatusContato }, "Status atualizado.")}
                className={cn(estiloControle, "h-9 w-auto")}
              >
                {STATUS_CONTATO.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.rotulo}
                  </option>
                ))}
              </select>
              <select
                aria-label="Responsável"
                value={c.responsavel_id ?? ""}
                disabled={!podeEditar || pendente}
                onChange={(e) => salvar({ responsavel_id: e.target.value || null }, "Responsável atualizado.")}
                className={cn(estiloControle, "h-9 w-auto")}
              >
                <option value="">Sem responsável</option>
                {ativas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <dl className="mt-5 divide-y divide-linha border-y border-linha">
              <div className={linha}>
                <dt className="text-texto-2">E-mail</dt>
                <dd>
                  <a href={`mailto:${c.email}`} className="link break-all">
                    {c.email}
                  </a>
                </dd>
              </div>
              <div className={linha}>
                <dt className="text-texto-2">Telefone</dt>
                <dd className="t-dado">{c.telefone ?? "–"}</dd>
              </div>
              <div className={linha}>
                <dt className="text-texto-2">Perfil</dt>
                <dd>{PERFIS_CONTATO[c.perfil]}</dd>
              </div>
              <div className={linha}>
                <dt className="text-texto-2">Cidade/UF</dt>
                <dd>{c.cidade_uf ?? "–"}</dd>
              </div>
              {c.perfil === "produtor" && (
                <>
                  <div className={linha}>
                    <dt className="text-texto-2">Área de café</dt>
                    <dd className="t-dado">{c.area_ha !== null ? `${c.area_ha} ha` : "–"}</dd>
                  </div>
                  <div className={linha}>
                    <dt className="text-texto-2">Colheita</dt>
                    <dd>{c.tipo_colheita ?? "–"}</dd>
                  </div>
                </>
              )}
            </dl>

            <h2 className="t-rotulo mt-6 text-texto-2">Mensagem</h2>
            <p className="mt-2 rounded-m bg-superficie p-4 whitespace-pre-line text-texto">{c.mensagem}</p>

            {c.tarefa_id && (
              <Link href={`/painel/tarefas/${c.tarefa_id}`} className="link mt-4 inline-flex items-center gap-1.5">
                <ExternalLink aria-hidden strokeWidth={1.75} className="size-4" /> Ver a tarefa “Responder contato”
              </Link>
            )}

            <h2 className="t-rotulo mt-6 text-texto-2">Notas internas</h2>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              disabled={!podeEditar}
              rows={5}
              placeholder="Só a equipe vê."
              aria-label="Notas internas"
              className={cn(estiloControle, "mt-2 py-2")}
            />
            {podeEditar && (
              <div className="mt-2 flex justify-end">
                <Botao tamanho="painel" disabled={pendente || notas === (c.notas ?? "")} onClick={() => salvar({ notas: notas || null }, "Notas salvas.")}>
                  Salvar notas
                </Botao>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
