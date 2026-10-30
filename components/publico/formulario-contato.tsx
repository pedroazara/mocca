"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { CircleAlert, LoaderCircle, Send } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Botao } from "@/components/ui/botao";
import { CaixaSelecao, Campo, descricaoDoCampo, estiloControle } from "@/components/ui/campo";
import { cn } from "@/lib/utils";
import {
  esquemaContato,
  formatarTelefone,
  perfis,
  tiposColheita,
  type DadosContato,
  type EntradaContato,
} from "@/lib/validacao/contato";

const CHAVE_TURNSTILE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
// em desenvolvimento, sem chave, o envio funciona sem a verificação (o servidor faz o mesmo)
const SEM_VERIFICACAO = !CHAVE_TURNSTILE && process.env.NODE_ENV !== "production";

type Estado = { tipo: "livre" } | { tipo: "enviado"; email: string } | { tipo: "falha"; mensagem: string };

export function FormularioContato() {
  const [estado, setEstado] = useState<Estado>({ tipo: "livre" });
  const [token, setToken] = useState<string | null>(null);
  const [erroToken, setErroToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileInstance>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EntradaContato, unknown, DadosContato>({
    resolver: zodResolver(esquemaContato),
    mode: "onTouched",
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      cidade_uf: "",
      area_ha: "",
      tipo_colheita: "",
      mensagem: "",
    },
  });

  const produtor = watch("perfil") === "produtor";
  const mensagem = watch("mensagem") ?? "";

  async function enviar(dados: DadosContato) {
    setEstado({ tipo: "livre" });
    if (!token && !SEM_VERIFICACAO) {
      setErroToken("Aguarde a verificação anti-spam terminar e tente de novo.");
      return;
    }
    try {
      const resposta = await fetch("/api/contato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, token: token ?? "desenvolvimento" }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (resposta.ok) {
        setEstado({ tipo: "enviado", email: dados.email });
        return;
      }
      const campos: Record<string, string> | undefined = corpo?.erro?.campos;
      if (campos) {
        for (const [campo, msg] of Object.entries(campos)) {
          setError(campo as keyof EntradaContato, { message: msg });
        }
      }
      setEstado({
        tipo: "falha",
        mensagem: corpo?.erro?.mensagem ?? "Não conseguimos enviar agora. Tente de novo em alguns minutos.",
      });
    } catch {
      setEstado({
        tipo: "falha",
        mensagem: "Sem conexão com o servidor. Confira sua internet e tente de novo; o que você escreveu continua aqui.",
      });
    }
    // o token do Turnstile vale para um envio só
    turnstile.current?.reset();
    setToken(null);
  }

  if (estado.tipo === "enviado") {
    return (
      <div role="status" className="rounded-g border border-linha bg-superficie p-8 md:p-10">
        <h2 className="t-h3 text-texto">Mensagem enviada.</h2>
        <p className="mt-2 text-texto-2">
          Vamos responder no e-mail <span className="font-semibold break-all text-texto">{estado.email}</span>.
        </p>
      </div>
    );
  }

  const erro = (campo: keyof EntradaContato) => errors[campo]?.message as string | undefined;
  const props = (campo: keyof EntradaContato, ajuda?: string) => ({
    id: campo,
    "aria-invalid": erro(campo) ? true : undefined,
    "aria-describedby": descricaoDoCampo(campo, erro(campo), ajuda),
  });

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="grid gap-5 sm:grid-cols-2">
      {estado.tipo === "falha" && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-m border border-erro/40 bg-erro-fundo p-4 text-erro sm:col-span-2"
        >
          <CircleAlert aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
          <p className="text-[0.9375rem]">{estado.mensagem}</p>
        </div>
      )}

      <Campo id="nome" rotulo="Nome" erro={erro("nome")} className="sm:col-span-2">
        <input
          {...register("nome")}
          {...props("nome")}
          autoComplete="name"
          className={cn(estiloControle, "h-10")}
        />
      </Campo>

      <Campo id="email" rotulo="E-mail" erro={erro("email")}>
        <input
          {...register("email")}
          {...props("email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          className={cn(estiloControle, "h-10")}
        />
      </Campo>

      <Campo id="telefone" rotulo="Telefone / WhatsApp" opcional erro={erro("telefone")}>
        <input
          {...register("telefone", {
            onChange: (e) => setValue("telefone", formatarTelefone(e.target.value)),
          })}
          {...props("telefone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(35) 99999-9999"
          className={cn(estiloControle, "h-10")}
        />
      </Campo>

      <Campo id="perfil" rotulo="Você é" erro={erro("perfil")}>
        <CaixaSelecao
          {...register("perfil")}
          {...props("perfil")}
          defaultValue=""
        >
          <option value="" disabled>
            Escolha uma opção
          </option>
          {perfis.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </CaixaSelecao>
      </Campo>

      <Campo id="cidade_uf" rotulo="Cidade / UF" opcional erro={erro("cidade_uf")}>
        <input
          {...register("cidade_uf")}
          {...props("cidade_uf")}
          autoComplete="address-level2"
          placeholder="Lavras, MG"
          className={cn(estiloControle, "h-10")}
        />
      </Campo>

      {produtor && (
        <>
          <Campo
            id="area_ha"
            rotulo="Área de café (ha)"
            erro={erro("area_ha")}
            ajuda="Só a área plantada com café."
          >
            <input
              {...register("area_ha")}
              {...props("area_ha", "Só a área plantada com café.")}
              inputMode="decimal"
              placeholder="Ex.: 25"
              className={cn(estiloControle, "h-10")}
            />
          </Campo>

          <Campo id="tipo_colheita" rotulo="Tipo de colheita" erro={erro("tipo_colheita")}>
            <CaixaSelecao
              {...register("tipo_colheita")}
              {...props("tipo_colheita")}
              defaultValue=""
            >
              <option value="" disabled>
                Escolha uma opção
              </option>
              {tiposColheita.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </CaixaSelecao>
          </Campo>
        </>
      )}

      <Campo
        id="mensagem"
        rotulo="Mensagem"
        erro={erro("mensagem")}
        className="sm:col-span-2"
        ajuda={`${mensagem.length} de 3000 caracteres`}
      >
        <textarea
          {...register("mensagem")}
          {...props("mensagem", `${mensagem.length} de 3000 caracteres`)}
          rows={6}
          maxLength={3000}
          className={cn(estiloControle, "min-h-36 resize-y py-2.5 leading-relaxed")}
        />
      </Campo>

      <div className="sm:col-span-2">
        <label htmlFor="consentimento" className="flex items-start gap-3 text-[0.9375rem] text-texto">
          <input
            {...register("consentimento")}
            id="consentimento"
            type="checkbox"
            aria-invalid={erro("consentimento") ? true : undefined}
            aria-describedby={erro("consentimento") ? "consentimento-erro" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-[var(--botao-primario)]"
          />
          <span>
            Concordo que a equipe MoCCa guarde estes dados para responder ao meu contato.{" "}
            <Link href="/privacidade" className="link">
              Privacidade
            </Link>
          </span>
        </label>
        {erro("consentimento") && (
          <p id="consentimento-erro" className="t-pequeno mt-1.5 flex items-start gap-1.5 text-erro">
            <CircleAlert aria-hidden strokeWidth={1.75} className="mt-px size-4 shrink-0" />
            {erro("consentimento")}
          </p>
        )}
      </div>

      <div className="sm:col-span-2">
        {CHAVE_TURNSTILE ? (
          <Turnstile
            ref={turnstile}
            siteKey={CHAVE_TURNSTILE}
            options={{ language: "pt-br", theme: "auto", size: "flexible" }}
            onSuccess={(t) => {
              setToken(t);
              setErroToken(null);
            }}
            onExpire={() => setToken(null)}
            onError={() => setErroToken("A verificação anti-spam falhou. Recarregue a página e tente de novo.")}
          />
        ) : SEM_VERIFICACAO ? null : (
          <p className="t-pequeno text-alerta">Verificação anti-spam não configurada (NEXT_PUBLIC_TURNSTILE_SITE_KEY).</p>
        )}
        {erroToken && (
          <p role="alert" className="t-pequeno mt-1.5 flex items-start gap-1.5 text-erro">
            <CircleAlert aria-hidden strokeWidth={1.75} className="mt-px size-4 shrink-0" />
            {erroToken}
          </p>
        )}
      </div>

      <div className="sm:col-span-2">
        <Botao type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />}
          {isSubmitting ? "Enviando…" : "Enviar mensagem"}
        </Botao>
      </div>
    </form>
  );
}
