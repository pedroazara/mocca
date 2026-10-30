import Image from "next/image";
import { cn } from "@/lib/utils";

const PROPORCAO_HORIZONTAL = 520.26 / 208;
const PROPORCAO_VERTICAL = 824 / 670;
const PROPORCAO_SIMBOLO = 322.41 / 375.92;

// A logo vem dos arquivos em /public/logo; nunca redesenhar em código (seção 4.2).
// Os SVGs já trazem a área de respiro, então a altura aqui inclui essa margem.
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
      <Image
        src="/logo/mocca-logo-horizontal-fundo-escuro.svg"
        alt="MoCCa"
        width={largura}
        height={altura}
        className={className}
        priority={prioridade}
      />
    );
  }
  return (
    <span className={cn("inline-flex", className)}>
      <Image
        src="/logo/mocca-logo-horizontal.svg"
        alt="MoCCa"
        width={largura}
        height={altura}
        className="so-claro"
        priority={prioridade}
      />
      <Image
        src="/logo/mocca-logo-horizontal-fundo-escuro.svg"
        alt="MoCCa"
        width={largura}
        height={altura}
        className="so-escuro"
      />
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
// Fora do logo, o site não usa o símbolo como marcador (pedido do Pedro).
// No escuro a metade espresso sumiria no fundo: troca pela versão de fundo escuro.
export function Pin({ tamanho = 20, className }: { tamanho?: number; className?: string }) {
  const largura = Math.round(tamanho * PROPORCAO_SIMBOLO);
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <Image src="/logo/mocca-simbolo.svg" alt="" aria-hidden width={largura} height={tamanho} className="so-claro" />
      <Image
        src="/logo/mocca-simbolo-fundo-escuro.svg"
        alt=""
        aria-hidden
        width={largura}
        height={tamanho}
        className="so-escuro"
      />
    </span>
  );
}
