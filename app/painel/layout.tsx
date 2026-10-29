import type { Metadata } from "next";
import { AoVivo } from "@/components/painel/ao-vivo";
import { BarraLateral } from "@/components/painel/barra-lateral";
import { ProvedorPainel } from "@/components/painel/contexto";
import { exigirPessoa } from "@/lib/auth";
import { comoUsuario } from "@/lib/banco";
import { base, contadores } from "@/lib/painel/dados";
import { semanaAtual } from "@/lib/painel/datas";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Painel MoCCa" },
  robots: { index: false, follow: false },
};

export default async function LayoutPainel({
  children,
  painel,
}: {
  children: React.ReactNode;
  painel: React.ReactNode;
}) {
  const eu = await exigirPessoa();
  const { b, c } = await comoUsuario(eu.authId, async (q) => ({ b: await base(q), c: await contadores(q, eu.id) }));
  const atual = semanaAtual(b.semanas)?.numero ?? 1;

  return (
    <ProvedorPainel
      eu={{ id: eu.id, nome: eu.nome, papel: eu.papel, cor: eu.cor }}
      pessoas={b.pessoas}
      semanas={b.semanas}
      etiquetas={b.etiquetas}
      semanaAtual={atual}
    >
      <div className="flex min-h-dvh text-[0.9375rem] leading-[1.5]">
        <BarraLateral contadores={c} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {painel}
      <AoVivo />
    </ProvedorPainel>
  );
}
