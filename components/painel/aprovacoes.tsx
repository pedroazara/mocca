"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { aprovarProposta, recusarProposta } from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { dataHora } from "@/lib/painel/datas";
import { resumirProposta, type LinhaProposta } from "@/lib/painel/propostas";
import type { Proposta } from "@/lib/painel/tipos";
import { usePainel } from "./contexto";
import { EstadoVazio } from "./elementos";

// Aprovações (seção 11.4, só admin): o que o Claude pediu com token e ainda não
// entrou no painel. Só dá para aprovar ou recusar; para mudar, peça de novo.

const estadoProposta = { pendente: "alerta", aprovada: "ok", recusada: "neutro", falhou: "erro" } as const;

function Linha({ linha }: { linha: LinhaProposta }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-[0.875rem] font-semibold text-texto">{linha.rotulo}</dt>
      <dd className="min-w-0">
        {linha.atual !== undefined && (
          <p className="max-h-32 overflow-y-auto text-[0.875rem] break-words whitespace-pre-wrap text-texto-2">
            <span className="t-rotulo mr-2 text-[0.6875rem]">hoje</span>
            {linha.atual}
          </p>
        )}
        <p className="max-h-60 overflow-y-auto text-[0.9375rem] break-words whitespace-pre-wrap text-texto">
          {linha.atual !== undefined && <span className="t-rotulo mr-2 text-[0.6875rem] text-texto-2">proposto</span>}
          {linha.proposto}
        </p>
      </dd>
    </div>
  );
}

function Cartao({ proposta: p, children }: { proposta: Proposta; children?: React.ReactNode }) {
  const { pessoa } = usePainel();
  const nome = (id: string) => {
    const x = pessoa(id);
    return x?.apelido ?? x?.nome ?? "Pessoa não encontrada";
  };
  const r = resumirProposta(p, nome);
  const quem = p.decidido_por ? nome(p.decidido_por) : null;
  return (
    <li id={`proposta-${p.id}`} className="scroll-mt-20 rounded-g border border-linha bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h3 className="min-w-0 font-medium break-words text-texto">{r.titulo}</h3>
        <Chip estado={estadoProposta[p.status]}>{p.status}</Chip>
      </div>
      <p className="t-dado mt-1 text-[0.8125rem] text-texto-2">
        {p.token_nome ?? "Token apagado"} · {dataHora(p.criado_em)}
        {p.decidido_em && quem && ` · ${p.status} por ${quem} em ${dataHora(p.decidido_em)}`}
      </p>
      {r.linhas.length > 0 && (
        <dl className="mt-3 divide-y divide-linha border-t border-linha">
          {r.linhas.map((l, i) => (
            <Linha key={i} linha={l} />
          ))}
        </dl>
      )}
      {r.aviso && <p className="mt-3 rounded-p bg-alerta-fundo px-3 py-2 text-[0.875rem] text-alerta">{r.aviso}</p>}
      {p.erro && <p className="mt-3 rounded-p bg-erro-fundo px-3 py-2 text-[0.875rem] text-erro">{p.erro}</p>}
      {children}
      {p.tarefa_id && (
        <p className="mt-3 text-[0.875rem]">
          <Link href={`/painel/tarefas/${p.tarefa_id}`} scroll={false} className="text-texto-2 underline hover:text-texto">
            Ver a tarefa
          </Link>
        </p>
      )}
    </li>
  );
}

export function PaginaAprovacoes({ pendentes, decididas }: { pendentes: Proposta[]; decididas: Proposta[] }) {
  const { avisar } = usePainel();
  const [ocupado, iniciar] = useTransition();

  const aprovar = (id: string) =>
    iniciar(async () => {
      const r = await aprovarProposta(id);
      if (!r.ok) avisar(r.erro, { erro: true });
      else if (r.dado.status === "falhou") avisar(`Não deu para aplicar: ${r.dado.erro}`, { erro: true });
      else avisar("Aprovada. A mudança já está no painel.");
    });

  const recusar = (id: string) =>
    iniciar(async () => {
      const r = await recusarProposta(id);
      if (!r.ok) avisar(r.erro, { erro: true });
      else avisar("Recusada. Nada mudou no painel.");
    });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-[1.0625rem] font-semibold text-texto">Aguardando você</h2>
        {pendentes.length === 0 ? (
          <EstadoVazio texto="Quando o Claude pedir uma mudança, ela aparece aqui. Nada entra no painel sem a sua aprovação." />
        ) : (
          <ul className="flex flex-col gap-3">
            {pendentes.map((p) => (
              <Cartao key={p.id} proposta={p}>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Botao tamanho="painel" disabled={ocupado} onClick={() => aprovar(p.id)}>
                    <Check aria-hidden /> Aprovar
                  </Botao>
                  <Botao variante="secundario" tamanho="painel" disabled={ocupado} onClick={() => recusar(p.id)}>
                    <X aria-hidden /> Recusar
                  </Botao>
                </div>
              </Cartao>
            ))}
          </ul>
        )}
      </section>

      {decididas.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-titulo text-[1.0625rem] font-semibold text-texto">Decididas</h2>
          <ul className="flex flex-col gap-3">
            {decididas.map((p) => (
              <Cartao key={p.id} proposta={p} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
