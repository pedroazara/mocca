import { cn } from "@/lib/utils";

// Esquema simplificado de uma colhedora de café vista de frente, com o ponto de
// medição (no tubo de saída, no alto da máquina) marcado pelo pin.
// TODO(pedro): trocar por um desenho técnico de verdade (seção 6.4 e DUVIDAS.md).
// Não indica marca, modelo nem tipo de equipamento de medição.

const frutos: { x: number; y: number; tom: "fill-erro" | "fill-ok" | "fill-torra" }[] = [
  { x: 252, y: 186, tom: "fill-erro" },
  { x: 300, y: 178, tom: "fill-ok" },
  { x: 236, y: 222, tom: "fill-erro" },
  { x: 276, y: 210, tom: "fill-erro" },
  { x: 318, y: 214, tom: "fill-torra" },
  { x: 228, y: 262, tom: "fill-ok" },
  { x: 262, y: 250, tom: "fill-erro" },
  { x: 300, y: 246, tom: "fill-erro" },
  { x: 332, y: 258, tom: "fill-erro" },
  { x: 246, y: 292, tom: "fill-torra" },
  { x: 284, y: 284, tom: "fill-erro" },
  { x: 318, y: 296, tom: "fill-ok" },
];

// o café sobe pelo elevador na lateral e sai por um tubo no alto, caindo no depósito
const tuboSaida = "M404 270 V 34 Q 404 10 380 10 H 356 Q 340 10 340 26 V 40";
const caminhoCafe = "M318 330 C 350 330, 384 322, 404 300 V 34 Q 404 10 380 10 H 356 Q 340 10 340 26 V 44";
// ponto de medição: no tubo de saída, no alto da máquina
const MEDICAO = { x: 384, y: 10 };

export function DiagramaColhedora({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 -40 560 420"
      role="img"
      aria-label="Esquema de uma colhedora de café vista de frente, passando por cima da fileira de café. O café derriçado desce, sobe pela lateral da máquina e sai por um tubo no alto, caindo no depósito. O ponto de medição, marcado com o pin, fica nesse tubo de saída."
      className={cn("h-auto w-full", className)}
    >
      <defs>
        <marker id="seta-cafe" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M1 1L9 5L1 9" fill="none" className="stroke-caramelo" strokeWidth={1.8} strokeLinecap="round" />
        </marker>
      </defs>

      {/* chão */}
      <path d="M24 340H536" className="stroke-linha" strokeWidth={2} />
      <path d="M60 346h40M140 350h24M440 348h44M500 352h18" className="stroke-linha" strokeWidth={1.5} strokeLinecap="round" />

      {/* pé de café */}
      <path
        d="M280 140 C 330 146, 356 196, 352 250 C 350 300, 330 336, 280 338 C 230 336, 210 300, 208 250 C 204 196, 230 146, 280 140 Z"
        className="fill-ok-fundo stroke-ok"
        strokeWidth={1.5}
      />
      <path d="M280 338V160M280 200l-26 -18M280 236l30 -20M280 272l-30 -16M280 300l24 -12" className="stroke-ok" strokeOpacity={0.6} strokeWidth={1.2} strokeLinecap="round" fill="none" />
      {frutos.map((f) => (
        <circle key={`${f.x}-${f.y}`} cx={f.x} cy={f.y} r={4} className={f.tom} />
      ))}

      {/* hastes que derriçam (um cilindro de cada lado da planta) */}
      {[186, 360].map((x) => (
        <g key={x}>
          <rect x={x} y={136} width={14} height={176} rx={7} className="fill-superficie-2 stroke-texto-2" strokeWidth={1.5} />
          {Array.from({ length: 8 }, (_, i) => 150 + i * 21).map((y) => (
            <path
              key={y}
              d={x < 280 ? `M${x + 14} ${y}q12 -4 24 2` : `M${x} ${y}q-12 -4 -24 2`}
              fill="none"
              className="stroke-texto-2"
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          ))}
        </g>
      ))}

      {/* pórtico: a máquina passa por cima da fileira */}
      <path
        d="M140 312 V 120 Q 140 100 160 100 H 400 Q 420 100 420 120 V 312"
        fill="none"
        className="stroke-texto"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path d="M170 312V128H390V312" fill="none" className="stroke-texto-2" strokeWidth={1.5} strokeLinejoin="round" />

      {/* cabine e depósito */}
      <rect x={160} y={38} width={92} height={62} rx={8} className="fill-superficie stroke-texto" strokeWidth={2} />
      <rect x={172} y={50} width={68} height={30} rx={4} className="fill-superficie-2 stroke-texto-2" strokeWidth={1.2} />
      <path d="M282 100 L 292 46 H 384 L 392 100 Z" className="fill-superficie-2 stroke-texto" strokeWidth={2} strokeLinejoin="round" />
      {[304, 326, 348, 368].map((x, i) => (
        <circle key={x} cx={x} cy={88 - (i % 2) * 6} r={4.5} className={i % 2 ? "fill-torra" : "fill-caramelo"} />
      ))}

      {/* elevador e tubo de saída: paredes do tubo em dois traços */}
      <path d={tuboSaida} fill="none" className="stroke-texto" strokeWidth={15} strokeLinejoin="round" />
      <path d={tuboSaida} fill="none" className="stroke-superficie-2" strokeWidth={10} strokeLinejoin="round" />

      {/* rodas */}
      {[155, 405].map((x) => (
        <g key={x}>
          <circle cx={x} cy={312} r={28} className="fill-superficie stroke-texto" strokeWidth={2.5} />
          <circle cx={x} cy={312} r={9} className="fill-superficie-2 stroke-texto-2" strokeWidth={1.5} />
        </g>
      ))}

      {/* caminho do café: da base da planta, sobe pelo elevador e sai no alto, no depósito */}
      <path
        d={caminhoCafe}
        fill="none"
        className="stroke-caramelo"
        strokeWidth={2.5}
        strokeDasharray="1 9"
        strokeLinecap="round"
        markerEnd="url(#seta-cafe)"
      />

      {/* ponto de medição: no tubo de saída */}
      <circle cx={MEDICAO.x} cy={MEDICAO.y} r={20} fill="none" className="stroke-caramelo" strokeOpacity={0.55} strokeWidth={1.2} />
      <circle cx={MEDICAO.x} cy={MEDICAO.y} r={34} fill="none" className="stroke-caramelo" strokeOpacity={0.25} strokeWidth={1.2} />
      <image href="/logo/mocca-simbolo.svg" x={MEDICAO.x - 12} y={MEDICAO.y - 32} width={24} height={33} />
      <path d={`M${MEDICAO.x + 38} ${MEDICAO.y}H452`} className="stroke-texto-2" strokeWidth={1.2} />

      <g className="font-dado">
        <text x={458} y={MEDICAO.y - 4} className="fill-texto text-[12px] font-medium tracking-[0.06em]">
          PONTO DE
        </text>
        <text x={458} y={MEDICAO.y + 12} className="fill-texto text-[12px] font-medium tracking-[0.06em]">
          MEDIÇÃO
        </text>
        <text x={430} y={150} className="fill-texto-2 text-[11px] tracking-[0.06em]">
          TUBO DE SAÍDA
        </text>
        <path d="M426 146H412" className="stroke-texto-2" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="2 3" />
        <text x={300} y={68} className="fill-texto-2 text-[10px] tracking-[0.06em]">
          DEPÓSITO
        </text>
        <text x={24} y={226} className="fill-texto-2 text-[11px] tracking-[0.06em]">
          HASTES
        </text>
        <path d="M76 222H180" className="stroke-texto-2" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="2 3" />
        <text x={24} y={372} className="fill-texto-2 text-[11px] tracking-[0.06em]">
          FILEIRA DE CAFÉ
        </text>
      </g>
    </svg>
  );
}
