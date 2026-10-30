import { cn } from "@/lib/utils";

// Colhedora de café vista de frente, passando por cima da fileira. O tubo de saída
// sai do alto da máquina, passa por cima da fileira vizinha e despeja o café no
// reservatório puxado por outro trator, na rua ao lado (a colhedora não tem
// depósito). O ponto de medição fica nesse tubo, marcado com o símbolo do MoCCa.
// Proporções de uma colhedora automotriz genérica, com 100 unidades = 1 m. Não
// indica marca, modelo nem tipo de equipamento de medição.
//
// As cores vêm de três variáveis, que quem usa define conforme o fundo:
// --fundo-desenho (a cor atrás do desenho), --desenho-destaque (o tubo).

const X0 = 30;
const LARGURA = 846;
const ALTURA = 492;
const ALTURA_COM_ROTULOS = 528;

const LINHA = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "butt",
  strokeLinejoin: "miter",
  vectorEffect: "non-scaling-stroke",
} as const;

// tons chapados, misturados com o fundo: funcionam em qualquer tema
const tom = (p: number) => `color-mix(in oklab, currentColor ${p}%, var(--fundo-desenho))`;
const PNEU = "color-mix(in oklab, var(--espresso) 72%, var(--fundo-desenho))";

function Peca({ d, cor, fina = false }: { d: string; cor: string; fina?: boolean }) {
  return <path d={d} {...LINHA} style={{ fill: cor }} strokeWidth={fina ? 1 : 1.6} />;
}

// Pé de café em silhueta: copa oval, tronco fino e cachos vermelhos, com o mesmo traço
// do resto do desenho. Coordenadas relativas ao centro do pé.
const COPA = "M0 214C42 214 66 276 69 340C71 394 52 432 24 440H-24C-52 432 -71 394 -69 340C-66 276 -42 214 0 214Z";
const TRONCO = "M-5 466L-3 440H3L5 466Z";
const CACHOS: [number, number][] = [
  [-13, 268], [15, 280],
  [-30, 306], [3, 316], [34, 304],
  [-46, 348], [-14, 356], [20, 346], [50, 356],
  [-34, 394], [0, 400], [33, 390],
];
const VERDE_COPA = "color-mix(in oklab, var(--fruto-verde) 72%, var(--espresso))";

function PeDeCafe({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <path d={TRONCO} {...LINHA} className="fill-fruto-passa" strokeWidth={1.6} />
      <path d={COPA} {...LINHA} style={{ fill: VERDE_COPA }} strokeWidth={1.6} />
      {CACHOS.map(([cx, cy], i) => (
        <g key={`${cx} ${cy}`} className="fill-fruto-cereja" transform={`rotate(${(i * 47) % 120} ${cx} ${cy})`}>
          <circle cx={cx - 4.4} cy={cy + 2} r={4.6} />
          <circle cx={cx + 4.4} cy={cy + 2} r={4.6} />
          <circle cx={cx} cy={cy - 4.6} r={4.6} />
        </g>
      ))}
    </g>
  );
}

const RISCOS_CHAO = [
  [79, 125],
  [349, 395],
  [674, 846],
]
  .flatMap(([a, b]) => Array.from({ length: Math.floor((b - a) / 14) + 1 }, (_, i) => `M${a + i * 14} 466l-12 12`))
  .join("");

// No celular "Colhedora" e "Tubo de saída" saem: não cabem em volta do selo.
const ROTULOS: { x: number; y: number; texto: string; destaque?: boolean; alinhar?: "direita"; soTelaGrande?: boolean }[] = [
  { x: 262, y: 22, texto: "Colhedora", soTelaGrande: true },
  { x: 470, y: 24, texto: "Ponto de medição", destaque: true },
  { x: 622, y: 124, texto: "Tubo de saída", soTelaGrande: true },
  { x: 235, y: 506, texto: "Fileira de café" },
  { x: 876, y: 506, texto: "Reservatório, em outro trator", alinhar: "direita" },
];

export function DiagramaColhedora({ className, rotulos = false }: { className?: string; rotulos?: boolean }) {
  const altura = rotulos ? ALTURA_COM_ROTULOS : ALTURA;
  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`${X0} 0 ${LARGURA} ${altura}`}
        role="img"
        aria-label="Desenho da colhedora de café vista de frente, passando por cima da fileira. No alto da máquina, o tubo de saída leva o café até o reservatório puxado por outro trator, que anda na rua ao lado. O ponto de medição fica nesse tubo."
        className="block h-auto w-full"
      >
        {/* chão */}
        <path d="M35 466H870" {...LINHA} strokeWidth={1.6} />
        <path d={RISCOS_CHAO} {...LINHA} strokeWidth={0.7} />

        {/* as duas fileiras de café: a que passa pelo túnel e a vizinha */}
        <PeDeCafe x={235} />
        <PeDeCafe x={585} />

        {/* colhedora: pórtico, rodas, motor, cabine e escada */}
        <Peca d="M163 186V436H133V342L75 302V136H395V302L337 342V436H307V186Z" cor={tom(16)} />
        <path d="M133 342V166M337 342V166M199 166H395" {...LINHA} strokeWidth={1} strokeOpacity={0.7} />
        <path d="M85 308.9V166M117 331V166M85 281H117M85 242H117M85 203H117" {...LINHA} strokeWidth={1} />
        {[75, 345].map((x) => (
          <g key={x}>
            <Peca d={`M${x + 3} 466H${x + 47}L${x + 50} 463V354L${x + 47} 351H${x + 3}L${x} 354V463Z`} cor={PNEU} />
            <path d={`M${x + 12} 466V351M${x + 38} 466V351`} {...LINHA} strokeWidth={1} strokeOpacity={0.6} />
          </g>
        ))}
        <Peca d="M261 136V114L273 102H357V136Z" cor={tom(26)} />
        <Peca d="M296 102V64H306V102Z" cor={tom(26)} fina />
        <Peca d="M357 136H395V81H357Z" cor={tom(26)} />
        <Peca d="M75 166H205V136L199 36H81L75 136Z" cor={tom(26)} />
        <Peca d="M71 36H209V26H71Z" cor={tom(40)} />
        <Peca d="M83 152H197L190 46H90Z" cor={tom(52)} fina />
        <path d="M148 46V152" {...LINHA} strokeWidth={1} />
        <path d="M79.5 60L53 54" {...LINHA} strokeWidth={1} />
        <Peca d="M43 90H53V48H43Z" cor={tom(26)} fina />

        {/* reservatório cheio de café, atrás do trator que o puxa */}
        <path d="M668 198Q700 158 742 156Q770 140 800 160Q836 168 852 198Z" className="fill-fruto-cereja" stroke="currentColor" strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d="M700 182Q716 170 734 172M764 164Q782 160 798 172M744 186Q760 180 776 186" fill="none" className="stroke-creme" strokeOpacity={0.35} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <Peca d="M681 366H839L855 196H665Z" cor={tom(22)} />
        <path d="M665.9 206H854.1" {...LINHA} strokeWidth={1} />
        {[670, 822].map((x) => (
          <Peca key={x} d={`M${x + 3} 466H${x + 25}L${x + 28} 463V384L${x + 25} 381H${x + 3}L${x} 384V463Z`} cor={PNEU} />
        ))}

        {/* trator, com o arco de proteção */}
        {[686, 804].map((x) => (
          <Peca key={x} d={`M${x + 3} 466H${x + 27}L${x + 30} 463V344L${x + 27} 341H${x + 3}L${x} 344V463Z`} cor={PNEU} />
        ))}
        <path d="M682 332H722M798 332H838M706 332V254M814 332V254" {...LINHA} strokeWidth={1.6} />
        <Peca d="M694 254H826V246H694Z" cor={tom(40)} />
        <Peca d="M738 410H782V324L774 316H746L738 324Z" cor={tom(40)} />
        <path d="M732 420H788" {...LINHA} strokeWidth={1.6} />
        {[714, 788].map((x) => (
          <Peca key={x} d={`M${x + 3} 466H${x + 15}L${x + 18} 463V384L${x + 15} 381H${x + 3}L${x} 384V463Z`} cor={PNEU} />
        ))}

        {/* o café cai da bica para dentro do reservatório */}
        <path d="M722 126H738L734 170H726Z" className="fill-fruto-cereja" stroke="currentColor" strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />

        {/* tubo de saída, em destaque, com setas no sentido do café */}
        <path d="M395 121.2V90.8L727 36.3L745 54V126H715V68.7Z" {...LINHA} style={{ fill: "var(--desenho-destaque)" }} strokeWidth={1.6} />
        <path d="M527.6 99L532.4 68.6M627.6 82.6L632.4 52.2M715 114H745" fill="none" stroke="var(--fundo-desenho)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        {[556, 592, 662].map((x) => {
          const y = 106 - (x - 395) * 0.164;
          return (
            <path
              key={x}
              d={`M${x - 6} ${y - 9}L${x + 4} ${y - 1}L${x - 3} ${y + 9}`}
              fill="none"
              stroke="var(--fundo-desenho)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* ponto de medição: selo creme com o símbolo do MoCCa, igual nos dois temas */}
        <circle cx={470} cy={93.7} r={50} fill="none" stroke="var(--fundo-desenho)" strokeWidth={10} vectorEffect="non-scaling-stroke" />
        <circle cx={470} cy={93.7} r={50} className="fill-creme" stroke="var(--vermelho)" strokeWidth={3.5} vectorEffect="non-scaling-stroke" />
        <image href="/logo/mocca-site-simbolo.svg" x={439.1} y={57.7} width={61.8} height={72} />
      </svg>

      {rotulos &&
        ROTULOS.map(({ x, y, texto, destaque, alinhar, soTelaGrande }) => (
          <span
            key={texto}
            aria-hidden
            style={
              alinhar === "direita"
                ? { right: 0, top: `${(y / altura) * 100}%` }
                : { left: `${((x - X0) / LARGURA) * 100}%`, top: `${(y / altura) * 100}%` }
            }
            className={cn(
              "absolute -translate-y-1/2 leading-none whitespace-nowrap",
              alinhar !== "direita" && "-translate-x-1/2",
              soTelaGrande && "hidden sm:inline",
              destaque ? "text-xs font-semibold text-link sm:text-base" : "text-[0.6875rem] text-texto-2 sm:text-[0.8125rem]",
            )}
          >
            {texto}
          </span>
        ))}
    </div>
  );
}
