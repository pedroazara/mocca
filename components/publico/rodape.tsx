import Link from "next/link";
import { CurvasDeNivel } from "./curvas-de-nivel";
import { LogoHorizontal } from "./logo";
import { COORDENADA_LAVRAS, linksPublicos } from "./navegacao";

export function Rodape() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-creme/10 bg-rodape-fundo text-creme">
      <CurvasDeNivel conjunto="rodape" className="absolute inset-0 -z-10 h-full w-full text-creme/[0.08]" />
      <div className="conteiner grid gap-10 pt-14 pb-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr_auto] lg:gap-12">
        <div className="max-w-xs">
          <LogoHorizontal altura={64} sempreEscura className="-ml-3" />
          <p className="mt-2 text-[0.9375rem] text-creme/80">Monitoramento de colheita de café, talhão por talhão.</p>
        </div>

        <nav aria-label="Rodapé">
          <h2 className="t-rotulo text-creme/70">Navegação</h2>
          <ul className="mt-4 space-y-2">
            {[{ href: "/", rotulo: "Início" }, ...linksPublicos].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-[0.9375rem] text-creme/90 underline-offset-[3px] hover:underline">
                  {l.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="t-rotulo text-creme/70">Onde estamos</h2>
          <p className="mt-4 text-[0.9375rem] text-creme/90">
            Universidade Federal de Lavras
            <br />
            Lavras, MG
          </p>
          <p className="t-dado mt-2 text-[0.8125rem] text-creme/75">{COORDENADA_LAVRAS}</p>
          {/* TODO(pedro): logos de UFLA, Embrapa Café e Avança Café só depois da autorização (seção 6.2). */}
        </div>

        <div>
          <Link
            href="/entrar"
            className="text-[0.8125rem] text-creme/70 underline-offset-[3px] hover:text-creme hover:underline"
          >
            Área da equipe
          </Link>
        </div>
      </div>

      <div className="conteiner flex flex-col gap-2 border-t border-creme/15 py-6 text-[0.8125rem] text-creme/75 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Equipe MoCCa · UFLA</p>
        <Link href="/privacidade" className="underline underline-offset-[3px] hover:text-creme">
          Privacidade
        </Link>
      </div>
    </footer>
  );
}
