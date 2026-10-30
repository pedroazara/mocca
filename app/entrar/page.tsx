import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BotaoGoogle } from "@/components/painel/botao-google";
import { CurvasDeNivel } from "@/components/publico/curvas-de-nivel";
import { DefinicoesCurvas } from "@/components/publico/curvas-definicoes";
import { LogoHorizontal } from "@/components/publico/logo";
import { Botao } from "@/components/ui/botao";
import { pessoaLogada, sessao } from "@/lib/auth";
import { comoServico, modoLocal, modoLocalPermitido } from "@/lib/banco";
import { entrarLocal } from "./acoes";

export const metadata: Metadata = {
  title: "Área da equipe",
  robots: { index: false, follow: false },
};

export default async function Entrar({ searchParams }: { searchParams: Promise<{ volta?: string }> }) {
  const { volta: voltaBruta } = await searchParams;
  const volta = voltaBruta?.startsWith("/painel") ? voltaBruta : "/painel";

  if (await sessao()) {
    if (await pessoaLogada()) redirect(volta);
    redirect("/acesso-negado");
  }

  const pessoasLocais =
    modoLocal && modoLocalPermitido
      ? await comoServico((q) =>
          q<{ auth_id: string; nome: string; papel: string; cor: string }>(
            "select auth_id, nome, papel::text as papel, cor from pessoa where ativo and auth_id is not null order by papel = 'orientador', nome",
          ),
        )
      : [];

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <DefinicoesCurvas />
      <CurvasDeNivel conjunto="hero" className="absolute inset-0 -z-10 h-full w-full text-caramelo/25" />
      <div className="w-full max-w-[400px] rounded-g border border-linha bg-superficie p-8 shadow-cartao">
        <LogoHorizontal altura={48} className="-ml-2" />
        <h1 className="t-h2 mt-4 text-texto">Área da equipe</h1>

        {modoLocal ? (
          <>
            <p className="mt-2 text-[0.9375rem] text-texto-2">
              Modo local: sem login Google. Escolha com quem entrar para testar o painel.
            </p>
            {modoLocalPermitido ? (
              <ul className="mt-6 space-y-2">
                {pessoasLocais.map((p) => (
                  <li key={p.auth_id}>
                    <form action={entrarLocal}>
                      <input type="hidden" name="authId" value={p.auth_id} />
                      <input type="hidden" name="volta" value={volta} />
                      <button
                        type="submit"
                        className="flex w-full items-center gap-3 rounded-m border border-linha px-3 py-2.5 text-left transition-colors duration-150 ease-out hover:bg-superficie-2"
                      >
                        <span
                          aria-hidden
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: p.cor }}
                        />
                        <span className="flex-1 font-medium text-texto">{p.nome}</span>
                        <span className="t-rotulo text-texto-2">{p.papel}</span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-pequeno mt-4 text-erro">
                O banco de dados não está configurado neste ambiente (DATABASE_URL).
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mt-2 text-[0.9375rem] text-texto-2">Entre com a conta Google cadastrada na equipe.</p>
            <div className="mt-6">
              <BotaoGoogle volta={volta} />
            </div>
          </>
        )}

        <Botao asChild variante="fantasma" tamanho="painel" className="mt-6 -ml-3.5">
          <Link href="/">Voltar para o site</Link>
        </Botao>
      </div>
    </main>
  );
}
