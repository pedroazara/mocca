"use client";

import { idCurvas } from "./curvas-de-nivel";
import { curvas, type ConjuntoCurvas } from "./curvas-dados";

// Definições SVG das curvas de nível, uma vez por página. É componente de cliente
// só por peso: assim os caminhos vão uma vez no HTML, e não também no payload do
// React; os dados já estão no JS do cabeçalho (menu do celular).
export function DefinicoesCurvas() {
  return (
    <svg aria-hidden focusable="false" width="0" height="0" className="absolute">
      <defs>
        {(Object.keys(curvas) as ConjuntoCurvas[]).map((nome) => (
          <path
            key={nome}
            id={idCurvas(nome)}
            d={curvas[nome].d}
            fill="none"
            strokeWidth={1}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </defs>
    </svg>
  );
}
