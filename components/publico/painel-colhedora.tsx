import { CenaColhedora } from "./cena-colhedora";
import { CurvasDeNivel } from "./curvas-de-nivel";
import { LegendaProducao } from "./grade-talhoes";
import { PalcoDaColhedora } from "./palco-colhedora";
import { CurvasDaLavoura, lavouraDoPainel } from "./passos-ilustrados";
import { RolagemDoPainel } from "./rolagem-painel";

// Painel do Início: a colhedora trabalhando e, conforme a página rola, o MoCCa
// encaixa por cima da esteira de saída (a câmera chega perto para mostrar a
// leitura do relevo do café) e depois a câmera se afasta até o mapa da fazenda,
// onde os talhões ganham a cor da produção. A rolagem está em rolagem-painel.tsx,
// as duas camadas em palco-colhedora.tsx e o desenho em cena-colhedora.tsx.
export function PainelColhedora({ className }: { className?: string }) {
  return (
    <figure className={className}>
      {/* sem JavaScript nada gruda: a cena aparece inteira, com o MoCCa no lugar */}
      <noscript>
        <style>{`.painel-rolagem::after{display:none}.painel-rolagem [data-surge]{opacity:1!important;transform:none!important}.painel-rolagem .camada-fazenda{display:none}`}</style>
      </noscript>
      <RolagemDoPainel>
        <PalcoDaColhedora
          cena={<CenaColhedora className="absolute inset-0 h-full w-full" />}
          curvas={<CurvasDeNivel conjunto="hero" className="absolute inset-0 h-full w-full text-caramelo/25" />}
          fundo={<CurvasDaLavoura />}
          {...lavouraDoPainel()}
        />
      </RolagemDoPainel>
      <figcaption className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="t-pequeno text-texto-2">Ilustração, sem escala. Mapa ilustrativo.</span>
        <LegendaProducao />
      </figcaption>
    </figure>
  );
}
