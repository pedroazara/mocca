"use client";

import { useState, useTransition } from "react";
import { criarSenha, entrarComSenha, verificarEmail } from "@/app/entrar/acoes";
import { Botao } from "@/components/ui/botao";
import { Campo, descricaoDoCampo, estiloControle } from "@/components/ui/campo";
import { SENHA_MINIMA } from "@/lib/login";
import { cn } from "@/lib/utils";

type Etapa = "email" | "senha" | "criar";

// Login em etapas: e-mail cadastrado na equipe, depois a senha. No primeiro
// acesso (pessoa sem conta), a segunda etapa cria a senha.
export function FormularioEntrar({ volta }: { volta: string }) {
  const [etapa, setEtapa] = useState<Etapa>("email");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string>();
  const [pendente, iniciar] = useTransition();
  const campo = cn(estiloControle, "h-10");

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(undefined);
    if (etapa === "criar" && senha !== confirmacao) {
      setErro("As senhas não são iguais.");
      return;
    }
    iniciar(async () => {
      if (etapa === "email") {
        const r = await verificarEmail(email);
        if (r.ok) setEtapa(r.etapa);
        else setErro(r.erro);
        return;
      }
      const r = await (etapa === "senha" ? entrarComSenha(email, senha, volta) : criarSenha(email, senha, volta));
      setErro(r.erro);
    });
  };

  const voltar = () => {
    setEtapa("email");
    setSenha("");
    setConfirmacao("");
    setErro(undefined);
  };

  return (
    <form onSubmit={enviar} className="mt-6 grid gap-4">
      {etapa === "email" ? (
        <Campo id="entrar-email" rotulo="E-mail" erro={erro}>
          <input
            id="entrar-email"
            type="email"
            autoComplete="username"
            autoFocus
            required
            className={campo}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(erro)}
            aria-describedby={descricaoDoCampo("entrar-email", erro)}
          />
        </Campo>
      ) : (
        <>
          <p className="t-pequeno break-words text-texto-2">
            {etapa === "criar" ? "Primeiro acesso de " : "Entrando como "}
            <span className="font-semibold text-texto">{email}</span>
          </p>
          <Campo
            id="entrar-senha"
            rotulo={etapa === "criar" ? "Crie uma senha" : "Senha"}
            ajuda={etapa === "criar" ? `Pelo menos ${SENHA_MINIMA} caracteres.` : undefined}
            erro={etapa === "senha" ? erro : undefined}
          >
            <input
              id="entrar-senha"
              type="password"
              autoComplete={etapa === "criar" ? "new-password" : "current-password"}
              autoFocus
              required
              minLength={etapa === "criar" ? SENHA_MINIMA : undefined}
              maxLength={72}
              className={campo}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              aria-invalid={etapa === "senha" && Boolean(erro)}
              aria-describedby={descricaoDoCampo(
                "entrar-senha",
                etapa === "senha" ? erro : undefined,
                etapa === "criar" ? "ajuda" : undefined,
              )}
            />
          </Campo>
          {etapa === "criar" && (
            <Campo id="entrar-confirmacao" rotulo="Repita a senha" erro={erro}>
              <input
                id="entrar-confirmacao"
                type="password"
                autoComplete="new-password"
                required
                maxLength={72}
                className={campo}
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                aria-invalid={Boolean(erro)}
                aria-describedby={descricaoDoCampo("entrar-confirmacao", erro)}
              />
            </Campo>
          )}
        </>
      )}

      <Botao type="submit" disabled={pendente} className="w-full">
        {pendente ? "Aguarde…" : etapa === "email" ? "Continuar" : etapa === "criar" ? "Criar senha e entrar" : "Entrar"}
      </Botao>
      {etapa !== "email" && (
        <Botao type="button" variante="fantasma" tamanho="painel" onClick={voltar} className="-mt-2 justify-self-start -ml-3.5">
          Usar outro e-mail
        </Botao>
      )}
    </form>
  );
}
