import Image from "next/image";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { grao } from "./logo-dados";

const PROPORCAO_HORIZONTAL = 520.26 / 208;
const PROPORCAO_VERTICAL = 824 / 670;
const PROPORCAO_SIMBOLO = 322.41 / 375.92;

// O símbolo em peças: cada metade e o pin se movem sozinhos ao passar o mouse, o que uma
// <img> não permite. Cada metade leva a linha creme do vinco na borda: fechadas, as duas se
// sobrepõem numa linha só. As cores vêm dos tokens --logo-* e a geometria de logo-dados.ts.
function GraoAnimado() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const metade = (classe: string, cor: string, regiao: string) => (
    <g className={classe}>
      <g transform={grao.giro} clipPath={`url(#${id}-elipse)`}>
        <ellipse rx={grao.rx} ry={grao.ry} fill={cor} clipPath={`url(#${id}-${regiao})`} />
        <path d={grao.vinco} fill="none" stroke="var(--creme)" strokeWidth={grao.vao} />
      </g>
    </g>
  );
  return (
    <svg viewBox={grao.viewBox} aria-hidden focusable="false" className="logo-grao">
      <defs>
        <clipPath id={`${id}-elipse`}>
          <ellipse rx={grao.rx} ry={grao.ry} />
        </clipPath>
        <clipPath id={`${id}-cima`}>
          <path d={grao.regiaoCima} />
        </clipPath>
        <clipPath id={`${id}-baixo`}>
          <path d={grao.regiaoBaixo} />
        </clipPath>
      </defs>
      {metade("logo-metade-cima", "var(--logo-cima)", "cima")}
      {metade("logo-metade-baixo", "var(--logo-baixo)", "baixo")}
      <g className="logo-pin">
        <path
          d={grao.pin}
          fill="var(--creme)"
          stroke="var(--creme)"
          strokeWidth={grao.vao * 2}
          strokeLinejoin="round"
        />
        <path d={grao.pinComFuro} fill="var(--vermelho)" fillRule="evenodd" />
      </g>
    </svg>
  );
}

// O "MoCCa" vem dos arquivos em /public/logo; nunca redesenhar em código (seção 4.2).
// Os SVGs já trazem a área de respiro, então a altura aqui inclui essa margem.
// O site usa a versão mocca-site-*: sem curvas e nos tons do tema, porque em 45 px
// as curvas viram ruído e o pin vermelho some no fundo escuro. A oficial fica em assets/logo.
export function LogoHorizontal({
  altura = 60,
  className,
  sempreEscura = false,
  prioridade = false,
}: {
  altura?: number;
  className?: string;
  sempreEscura?: boolean;
  prioridade?: boolean;
}) {
  const largura = Math.round(altura * PROPORCAO_HORIZONTAL);
  if (sempreEscura) {
    return (
      <span className={cn("logo-animada logo-sempre-escura inline-flex", className)}>
        <Image
          src="/logo/mocca-site-texto-fundo-escuro.svg"
          alt="MoCCa"
          width={largura}
          height={altura}
          priority={prioridade}
        />
        <GraoAnimado />
      </span>
    );
  }
  return (
    <span className={cn("logo-animada inline-flex", className)}>
      <Image
        src="/logo/mocca-site-texto.svg"
        alt="MoCCa"
        width={largura}
        height={altura}
        className="so-claro"
        priority={prioridade}
      />
      <Image
        src="/logo/mocca-site-texto-fundo-escuro.svg"
        alt="MoCCa"
        width={largura}
        height={altura}
        className="so-escuro"
      />
      <GraoAnimado />
    </span>
  );
}

export function LogoVertical({ largura = 220, className }: { largura?: number; className?: string }) {
  const altura = Math.round(largura / PROPORCAO_VERTICAL);
  return (
    <span className={cn("inline-flex", className)}>
      <Image src="/logo/mocca-logo-vertical.svg" alt="MoCCa" width={largura} height={altura} className="so-claro" />
      <Image
        src="/logo/mocca-logo-vertical-fundo-escuro.svg"
        alt="MoCCa"
        width={largura}
        height={altura}
        className="so-escuro"
      />
    </span>
  );
}

// Símbolo (grão com pin): é o logo compacto (barra lateral recolhida do painel).
// Fora do logo, o site não usa o símbolo como marcador (pedido do Pedro). A única exceção,
// também pedida por ele, é o ponto de medição no desenho da colhedora.
export function Pin({ tamanho = 20, className }: { tamanho?: number; className?: string }) {
  const largura = Math.round(tamanho * PROPORCAO_SIMBOLO);
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <Image src="/logo/mocca-site-simbolo.svg" alt="" aria-hidden width={largura} height={tamanho} className="so-claro" />
      <Image
        src="/logo/mocca-site-simbolo-fundo-escuro.svg"
        alt=""
        aria-hidden
        width={largura}
        height={tamanho}
        className="so-escuro"
      />
    </span>
  );
}
