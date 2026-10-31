"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ImagePlus, Pencil, Trash2, UserPlus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { criarPessoa, atualizarPessoa, definirAtivo, type DadosPessoa } from "@/app/painel/acoes";
import { Botao } from "@/components/ui/botao";
import { estiloControle } from "@/components/ui/campo";
import { estaAtrasada } from "@/lib/painel/datas";
import { recortarFoto } from "@/lib/painel/perfil";
import type { PapelPainel, Perfil, Pessoa, TarefaResumo } from "@/lib/painel/tipos";
import { cn } from "@/lib/utils";
import { usePainel } from "./contexto";
import { Avatar } from "./elementos";

// Equipe (seção 9.8): cartão por pessoa com números da semana; o admin
// adiciona, edita e desativa (nunca apaga: o histórico fica). Foto e LinkedIn
// aparecem também na página Equipe do site.

const CORES = ["#2F5F86", "#4A2C1D", "#7A3F7A", "#3F6B4A", "#8F4A1F", "#5A5048", "#A2412F", "#3D6E70"];
const PAPEIS: Record<PapelPainel, string> = { admin: "admin", membro: "membro", orientador: "orientador" };

export function GradeEquipe({ tarefas, perfis }: { tarefas: TarefaResumo[]; perfis: Perfil[] }) {
  const { pessoas, semanaAtual, ehAdmin } = usePainel();
  const [editar, setEditar] = useState<Pessoa | "nova" | null>(null);
  const ativas = pessoas.filter((p) => p.ativo);
  const inativas = pessoas.filter((p) => !p.ativo);
  const perfilDe = (id: string) => perfis.find((x) => x.pessoa_id === id);

  const numeros = (id: string) => {
    const minhas = tarefas.filter((t) => t.atribuicoes.some((a) => a.pessoa_id === id));
    return {
      abertas: minhas.filter((t) => t.status !== "feito").length,
      atrasadas: minhas.filter((t) => estaAtrasada(t)).length,
      feitasSemana: minhas.filter((t) => t.status === "feito" && t.semana === semanaAtual).length,
    };
  };

  const cartao = (p: Pessoa) => {
    const n = numeros(p.id);
    return (
      <li key={p.id} className={cn("relative rounded-g border border-linha bg-superficie p-5", !p.ativo && "opacity-60")}>
        <div className="flex items-start gap-3">
          <Avatar pessoa={p} tamanho={40} foto={perfilDe(p.id)?.foto_url} />
          <div className="min-w-0 flex-1">
            <Link href={`/painel/equipe/${p.id}`} className="font-titulo text-[1.0625rem] font-semibold text-texto after:absolute after:inset-0 hover:underline">
              {p.nome}
            </Link>
            <p className="t-rotulo mt-0.5 text-[0.6875rem] text-texto-2">
              {PAPEIS[p.papel]}
              {!p.ativo && " · inativo"}
            </p>
          </div>
          {ehAdmin && (
            <button
              type="button"
              aria-label={`Editar ${p.nome}`}
              onClick={() => setEditar(p)}
              className="relative z-10 rounded-p p-1.5 text-texto-2 hover:bg-superficie-2 hover:text-texto"
            >
              <Pencil aria-hidden strokeWidth={1.75} className="size-4" />
            </button>
          )}
        </div>
        {p.frente && <p className="mt-3 text-[0.875rem] text-texto-2">{p.frente}</p>}
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-linha pt-3">
          {(
            [
              ["abertas", n.abertas, "text-texto"],
              ["atrasadas", n.atrasadas, n.atrasadas ? "text-erro" : "text-texto"],
              ["feitas na semana", n.feitasSemana, "text-ok"],
            ] as const
          ).map(([r, v, c]) => (
            <div key={r}>
              <dt className="text-[0.75rem] text-texto-2">{r}</dt>
              <dd className={cn("t-dado text-[1.25rem] font-medium", c)}>{v}</dd>
            </div>
          ))}
        </dl>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      {ehAdmin && (
        <div>
          <Botao variante="secundario" tamanho="painel" onClick={() => setEditar("nova")}>
            <UserPlus aria-hidden /> Adicionar pessoa
          </Botao>
        </div>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{ativas.map(cartao)}</ul>
      {inativas.length > 0 && (
        <section>
          <h2 className="t-rotulo mb-3 text-texto-2">Inativos</h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{inativas.map(cartao)}</ul>
        </section>
      )}
      {editar && (
        <FormPessoa
          pessoa={editar === "nova" ? null : editar}
          perfil={editar === "nova" ? undefined : perfilDe(editar.id)}
          aoFechar={() => setEditar(null)}
        />
      )}
    </div>
  );
}

function FormPessoa({ pessoa, perfil, aoFechar }: { pessoa: Pessoa | null; perfil?: Perfil; aoFechar: () => void }) {
  const { avisar, eu } = usePainel();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [d, setD] = useState<DadosPessoa>({
    nome: pessoa?.nome ?? "",
    apelido: pessoa?.apelido ?? "",
    email: pessoa?.email ?? "",
    frente: pessoa?.frente ?? "",
    papel: pessoa?.papel ?? "membro",
    cor: pessoa?.cor ?? CORES[0],
    linkedin: perfil?.linkedin ?? "",
  });
  // a foto nova ainda só existe no navegador: é recortada ao salvar
  const [fotoNova, setFotoNova] = useState<{ url: string; posicao: number } | null>(null);
  const [semFoto, setSemFoto] = useState(false);
  const imagem = useRef<HTMLImageElement>(null);
  const campo = cn(estiloControle, "h-10");
  const fotoAtual = semFoto ? null : perfil?.foto_url;

  useEffect(() => {
    if (!fotoNova?.url) return;
    return () => URL.revokeObjectURL(fotoNova.url);
  }, [fotoNova?.url]);

  const escolherFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    setErro(null);
    setFotoNova({ url: URL.createObjectURL(arquivo), posicao: 50 });
  };

  const removerFoto = () => {
    setFotoNova(null);
    setSemFoto(true);
  };

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    const foto = fotoNova && imagem.current ? recortarFoto(imagem.current, fotoNova.posicao) : semFoto ? null : undefined;
    iniciar(async () => {
      const dados = { ...d, foto };
      const r = pessoa ? await atualizarPessoa(pessoa.id, dados) : await criarPessoa(dados);
      if (!r.ok) setErro(r.erro);
      else {
        avisar(pessoa ? "Pessoa atualizada." : "Pessoa adicionada. No primeiro acesso, ela cria a senha com este e-mail.");
        aoFechar();
      }
    });
  };

  return (
    <Dialog.Root open onOpenChange={(a) => !a && aoFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-texto/30" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-g border border-linha bg-superficie p-6 shadow-flutuante"
        >
          <div className="flex items-start justify-between">
            <Dialog.Title className="font-titulo text-[1.25rem] font-semibold text-texto">
              {pessoa ? `Editar ${pessoa.nome}` : "Adicionar pessoa"}
            </Dialog.Title>
            <Dialog.Close aria-label="Fechar" className="-mt-1 -mr-2 rounded-p p-2 text-texto-2 hover:bg-superficie-2">
              <X aria-hidden strokeWidth={1.75} className="size-[18px]" />
            </Dialog.Close>
          </div>
          <form onSubmit={salvar} className="mt-5 grid gap-3">
            <label className="grid gap-1">
              <span className="text-[0.875rem] font-semibold">Nome</span>
              <input className={campo} value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-[0.875rem] font-semibold">Apelido</span>
                <input className={campo} value={d.apelido ?? ""} onChange={(e) => setD({ ...d, apelido: e.target.value })} placeholder="Pinotti" />
              </label>
              <label className="grid gap-1">
                <span className="text-[0.875rem] font-semibold">Papel no painel</span>
                <select className={campo} value={d.papel} onChange={(e) => setD({ ...d, papel: e.target.value as PapelPainel })}>
                  <option value="membro">membro</option>
                  <option value="admin">admin</option>
                  <option value="orientador">orientador (só lê e comenta)</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1">
              <span className="text-[0.875rem] font-semibold">E-mail</span>
              <input type="email" className={campo} value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} required />
            </label>
            <label className="grid gap-1">
              <span className="text-[0.875rem] font-semibold">Frente</span>
              <input className={campo} value={d.frente ?? ""} onChange={(e) => setD({ ...d, frente: e.target.value })} placeholder="Tecnologia e operações" />
            </label>
            <label className="grid gap-1">
              <span className="text-[0.875rem] font-semibold">LinkedIn</span>
              <input
                inputMode="url"
                className={campo}
                value={d.linkedin ?? ""}
                onChange={(e) => setD({ ...d, linkedin: e.target.value })}
                placeholder="linkedin.com/in/seu-nome"
              />
            </label>
            <fieldset>
              <legend className="mb-1.5 text-[0.875rem] font-semibold">Foto no site</legend>
              <div className="relative aspect-[4/3] w-48 overflow-hidden rounded-m border border-linha bg-superficie-2">
                {fotoNova ? (
                  <Image
                    ref={imagem}
                    src={fotoNova.url}
                    alt="Prévia da foto"
                    fill
                    unoptimized
                    className="object-cover"
                    style={{ objectPosition: `${fotoNova.posicao}% ${fotoNova.posicao}%` }}
                    onError={() => {
                      setFotoNova(null);
                      setErro("Não foi possível abrir essa imagem. Use JPG, PNG ou WebP.");
                    }}
                  />
                ) : fotoAtual ? (
                  <Image src={fotoAtual} alt="Foto atual" fill unoptimized className="object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-[0.8125rem] text-texto-2">
                    Sem foto: o site mostra as iniciais.
                  </span>
                )}
              </div>
              {fotoNova && (
                <label className="mt-2 grid w-48 gap-1">
                  <span className="text-[0.8125rem] text-texto-2">Enquadramento</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={fotoNova.posicao}
                    onChange={(e) => setFotoNova({ ...fotoNova, posicao: Number(e.target.value) })}
                    className="accent-caramelo"
                  />
                </label>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-p border border-linha px-3 text-[0.875rem] text-texto hover:bg-superficie-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-link">
                  <ImagePlus aria-hidden strokeWidth={1.75} className="size-4" />
                  {fotoAtual || fotoNova ? "Trocar foto" : "Escolher foto"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={escolherFoto} className="sr-only" />
                </label>
                {(fotoAtual || fotoNova) && (
                  <Botao type="button" variante="fantasma" tamanho="painel" onClick={removerFoto}>
                    <Trash2 aria-hidden /> Remover
                  </Botao>
                )}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-[0.875rem] font-semibold">Cor</legend>
              <div className="flex flex-wrap gap-2">
                {CORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    aria-pressed={d.cor === c}
                    onClick={() => setD({ ...d, cor: c })}
                    className={cn("size-8 rounded-full ring-offset-2 ring-offset-superficie", d.cor === c && "ring-2 ring-texto")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </fieldset>
            {erro && <p className="t-pequeno text-erro">{erro}</p>}
            <div className="mt-2 flex items-center justify-between gap-2">
              {pessoa && pessoa.id !== eu.id ? (
                <Botao
                  type="button"
                  variante="fantasma"
                  tamanho="painel"
                  className={pessoa.ativo ? "text-erro" : ""}
                  onClick={() =>
                    iniciar(async () => {
                      const r = await definirAtivo(pessoa.id, !pessoa.ativo);
                      if (!r.ok) setErro(r.erro);
                      else {
                        avisar(pessoa.ativo ? "Pessoa desativada. O histórico dela continua." : "Pessoa reativada.");
                        aoFechar();
                      }
                    })
                  }
                >
                  {pessoa.ativo ? "Desativar" : "Reativar"}
                </Botao>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <Botao type="button" variante="fantasma" tamanho="painel">
                    Cancelar
                  </Botao>
                </Dialog.Close>
                <Botao type="submit" tamanho="painel" disabled={pendente}>
                  {pessoa ? "Salvar" : "Adicionar pessoa"}
                </Botao>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
