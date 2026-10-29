"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { criarTarefa } from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { estiloControle } from "@/components/ui/campo";
import { deCampoData } from "@/lib/painel/datas";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { Avatar, ChipEtiqueta } from "./elementos";

// Diálogo "Nova tarefa" (botão do topo e atalho N).

export function DialogoNovaTarefa({
  aberto,
  aoMudar,
  semanaInicial,
  reuniaoId,
}: {
  aberto: boolean;
  aoMudar: (v: boolean) => void;
  semanaInicial?: number;
  reuniaoId?: string;
}) {
  const { semanas, semanaAtual, etiquetas, ativas, eu, avisar } = usePainel();
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [semana, setSemana] = useState<number>(semanaInicial ?? semanaAtual);
  const [prazo, setPrazo] = useState("");
  const [etqs, setEtqs] = useState<string[]>([]);
  const [resp, setResp] = useState<string[]>([]);
  const [entrega, setEntrega] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  function limpar() {
    setTitulo("");
    setPrazo("");
    setEtqs([]);
    setResp([]);
    setEntrega(false);
    setErro(null);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) {
      setErro("Dê um título para a tarefa.");
      return;
    }
    iniciar(async () => {
      const r = await criarTarefa({
        titulo,
        semana,
        prazo: deCampoData(prazo),
        etiquetas: etqs,
        responsaveis: resp,
        ligada_entrega: entrega,
        origem: reuniaoId ? "reuniao" : "manual",
        reuniao_id: reuniaoId ?? null,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      aoMudar(false);
      limpar();
      avisar("Tarefa criada.");
      if (r.dado) router.push(`/painel/tarefas/${r.dado}`);
    });
  }

  const fim = semanas.find((s) => s.numero === semana)?.fim;

  return (
    <Dialog.Root open={aberto} onOpenChange={aoMudar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-texto/30" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-g border border-linha bg-superficie p-6 shadow-flutuante"
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-titulo text-[1.25rem] font-semibold text-texto">Nova tarefa</Dialog.Title>
            <Dialog.Close aria-label="Fechar" className="-mt-1 -mr-2 rounded-p p-2 text-texto-2 hover:bg-superficie-2">
              <X aria-hidden strokeWidth={1.75} className="size-[18px]" />
            </Dialog.Close>
          </div>
          <form onSubmit={enviar} className="mt-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-semibold text-texto">Título</span>
              <input
                autoFocus
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={200}
                placeholder="Entrevistas de disposição a pagar"
                className={cn(estiloControle, "h-10")}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.875rem] font-semibold text-texto">Semana</span>
                <select
                  value={semana}
                  onChange={(e) => setSemana(Number(e.target.value))}
                  className={cn(estiloControle, "h-10")}
                >
                  {semanas.map((s) => (
                    <option key={s.numero} value={s.numero}>
                      Semana {s.numero}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.875rem] font-semibold text-texto">Prazo</span>
                <input
                  type="date"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  className={cn(estiloControle, "h-10")}
                />
                {!prazo && fim && <span className="t-pequeno text-texto-2">Sem data: fim da semana.</span>}
              </label>
            </div>
            <fieldset>
              <legend className="mb-1.5 text-[0.875rem] font-semibold text-texto">Responsáveis</legend>
              <div className="flex flex-wrap gap-2">
                {ativas
                  .filter((p) => p.papel !== "orientador")
                  .map((p) => {
                    const sel = resp.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={sel}
                        onClick={() => setResp(alternar(resp, p.id))}
                        className={cn(
                          "inline-flex h-9 items-center gap-2 rounded-full border pr-3 pl-1 text-[0.875rem] transition-colors duration-150",
                          sel ? "border-texto bg-superficie-2 font-semibold text-texto" : "border-linha text-texto-2 hover:bg-superficie-2",
                        )}
                      >
                        <Avatar pessoa={p} tamanho={28} titulo={false} />
                        {p.apelido ?? p.nome.split(" ")[0]}
                        {p.id === eu.id && <span className="text-texto-2">(você)</span>}
                        {sel && <Check aria-hidden strokeWidth={2} className="size-3.5" />}
                      </button>
                    );
                  })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-[0.875rem] font-semibold text-texto">Etiquetas</legend>
              <div className="flex flex-wrap gap-2">
                {etiquetas.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={etqs.includes(e.id)}
                    onClick={() => setEtqs(alternar(etqs, e.id))}
                    className={cn(
                      "rounded-full ring-offset-2 ring-offset-superficie transition-opacity",
                      etqs.includes(e.id) ? "ring-2 ring-texto" : "opacity-70 hover:opacity-100",
                    )}
                  >
                    <ChipEtiqueta etiqueta={e} />
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2.5 text-[0.9375rem] text-texto">
              <input
                type="checkbox"
                checked={entrega}
                onChange={(e) => setEntrega(e.target.checked)}
                className="size-4 accent-[var(--botao-primario)]"
              />
              Ligada à entrega do programa
            </label>
            {erro && <p className="t-pequeno text-erro">{erro}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <Botao type="button" variante="fantasma" tamanho="painel">
                  Cancelar
                </Botao>
              </Dialog.Close>
              <Botao type="submit" tamanho="painel" disabled={pendente}>
                {pendente ? "Criando…" : "Criar tarefa"}
              </Botao>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
