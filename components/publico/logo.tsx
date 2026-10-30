import Image from "next/image";
import { cn } from "@/lib/utils";

const PROPORCAO_HORIZONTAL = 517 / 216;
const PROPORCAO_VERTICAL = 824 / 670;

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

// Símbolo (grão-pin): é o logo compacto (barra lateral recolhida do painel).
// Fora do logo, o site não usa o símbolo como marcador (pedido do Pedro).
export function Pin({ tamanho = 20, className }: { tamanho?: number; className?: string }) {
  return (
    <Image
      src="/logo/mocca-simbolo.svg"
      alt=""
      aria-hidden
      width={Math.round((tamanho * 280) / 388)}
      height={tamanho}
      className={cn("shrink-0", className)}
    />
  );
}
