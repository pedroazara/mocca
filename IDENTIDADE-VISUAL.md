# MoCCa · Identidade visual

Resumo do que o site usa hoje. Fonte de verdade no código: `app/globals.css` (tokens CSS) e `lib/tokens.ts` (espelho em TypeScript).

## Conceito

Linguagem de **mapa de lavoura**: curvas de nível, mapa de produtividade e coordenadas. Cores do café torrado (espresso, caramelo, creme). Deve parecer um instrumento de agricultura de precisão feito por quem conhece a lavoura. O site é **simples e informativo**, para apresentar o MoCCa ao agro.

## Logo

Um grão de café inclinado 30°, dividido pelo vinco em duas metades, com um pin vermelho no centro. As duas metades têm curvas de nível finas, e cada uma desenha as curvas na cor da outra. O vinco e o respiro em volta do pin são vazados (mostram o fundo).

| Uso | Arquivo (`public/logo/`) |
|---|---|
| Cabeçalho, fundo claro | `mocca-logo-horizontal.svg` |
| Cabeçalho, fundo escuro / rodapé | `mocca-logo-horizontal-fundo-escuro.svg` |
| Versão vertical | `mocca-logo-vertical.svg` / `-fundo-escuro.svg` |
| Símbolo (grão com pin) | `mocca-simbolo.svg` / `-fundo-escuro.svg` |
| Símbolo numa cor só (gravação, carimbo) | `mocca-simbolo-mono.svg` |
| Ícone de app / favicon | `mocca-icone-app.svg` / `.png` |

| Versão | Metade de cima | Metade de baixo | Pin | "MoCCa" |
|---|---|---|---|---|
| Fundo claro | `#96592A`, curvas espresso | espresso, curvas `#96592A` | vermelho | "Mo" e "a" espresso, "CC" `#96592A` |
| Fundo escuro | caramelo, curvas `#96592A` | torra, curvas caramelo | vermelho | "Mo" e "a" creme, "CC" caramelo |

### Versão do site

O kit acima é a logo oficial (`assets/logo/`), para materiais e envios. O cabeçalho, o rodapé, o login e o painel usam uma versão só do site (`public/logo/mocca-site-*.svg`), porque com 45 px de altura as curvas viram ruído, e o fundo do site já tem curvas de nível. Ela não tem curvas, tem o vinco mais largo e acompanha o destaque do tema:

| Tema | Metade de cima | Metade de baixo | Volta do pin | "MoCCa" |
|---|---|---|---|---|
| Claro | caramelo | espresso | creme | "Mo" e "a" espresso, "CC" caramelo |
| Escuro / rodapé | `#D49360` | `#96592A` | creme | "Mo" e "a" creme, "CC" `#D49360` |

O vinco é vazado nos dois temas. O contorno creme faz parte do pin, para ele aparecer sobre qualquer fundo e as metades ficarem inteiras. O S do vinco é mais suave que o da logo oficial, para cada metade parecer um grão partido quando abre. A imagem de compartilhamento e o favicon continuam com a logo oficial.

Para o grão poder abrir, o símbolo da logo horizontal é desenhado na página (`GraoAnimado`, com a geometria em `components/publico/logo-dados.ts` e as cores em `--logo-cima` e `--logo-baixo`). Só o "MoCCa" é imagem (`mocca-site-texto.svg`). Se a logo do site mudar, atualizar os dois.

### Regras

- No fundo escuro as metades sobem um tom porque o espresso sumiria no fundo.
- O ícone de app tem fundo creme (sobre espresso o pin vermelho some) e vinco mais largo, para aguentar 16–32 px.
- Altura mínima: horizontal 28 px, símbolo 20 px.
- Respiro mínimo: a altura do "o" de MoCCa em todos os lados.
- Não redesenhar, não aplicar sombra, contorno, gradiente, rotação nem cores fora da paleta.

## Cores da marca

| Nome | Hex | Uso |
|---|---|---|
| Espresso | `#4A2C1D` | Títulos, botão primário, rodapé, metade de baixo do grão |
| Caramelo | `#B9733F` | Destaques grandes, marcadores, ícones, gráficos, foco |
| Caramelo (texto) | `#96592A` | Links e texto pequeno em caramelo (5,0:1), metade de cima do grão, "CC" da logo |
| Marrom-torra | `#8A5A3B` | Texto secundário de marca |
| Creme | `#F6F1E7` | Fundo do tema claro |
| Vermelho | `#771900` | Só o pin da logo |

Caramelo `#B9733F` sobre creme dá 3,3:1: só para ícones, gráficos e texto acima de 24 px.

## Superfícies e texto

| Token | Claro | Escuro |
|---|---|---|
| `--fundo` | `#F6F1E7` | `#1A120D` |
| `--superficie` (cartões) | `#FFFCF7` | `#241912` |
| `--superficie-2` (hover, cabeçalho de tabela) | `#EFE6DA` | `#2F2118` |
| `--linha` (bordas) | `#E3D6C5` | `#3B2B21` |
| `--texto` | `#2B1A11` | `#F3E9DC` |
| `--texto-2` | `#6E5444` | `#B79E8A` |
| `--link` | `#96592A` | `#D49360` |
| `--foco` | `#B9733F` | `#D49360` |
| `--caramelo` | `#B9733F` | `#D49360` |
| `--rodape-fundo` | `#4A2C1D` | `#120C08` |

## Botões

| Token | Claro | Escuro |
|---|---|---|
| `--botao-primario` | `#4A2C1D` | `#D49360` |
| `--botao-primario-texto` | `#F6F1E7` | `#1A120D` |
| `--botao-primario-hover` | `#5E3A27` | `#E0A676` |

## Estados

| Estado | Cor (claro / escuro) | Fundo (claro / escuro) |
|---|---|---|
| ok | `#3F7A4A` / `#8CC795` | `#E1EEDF` / `#20311F` |
| alerta | `#8F6210` / `#E3B862` | `#F5E8C8` / `#362B14` |
| erro | `#A2412F` / `#E58B78` | `#F5DED7` / `#3A211B` |
| info | `#2F5F86` / `#8DB8DD` | `#DDE8F1` / `#1C2A36` |

## Etiquetas das tarefas (painel)

| Etiqueta | Claro | Escuro |
|---|---|---|
| Entregas | `#A2412F` | `#E58B78` |
| Validação do Produto | `#2F5F86` | `#8DB8DD` |
| Técnico | `#3F7A4A` | `#8CC795` |
| Negócio | `#8F6210` | `#E3B862` |
| Marketing | `#7A3F7A` | `#D39BD3` |

## Escala de produção (mapas)

Cinco faixas, de baixa para alta. No tema escuro a escala se inverte para continuar legível.

| Token | Claro | Escuro |
|---|---|---|
| `--talhao-1` (baixa) | `#E3D6C5` (= linha) | torra 28% + superfície-2 |
| `--talhao-2` | caramelo 45% + linha | torra 64% + superfície-2 |
| `--talhao-3` | `#B9733F` (caramelo) | `#8A5A3B` (torra) |
| `--talhao-4` | `#8A5A3B` (torra) | `#D49360` (caramelo escuro) |
| `--talhao-5` (alta) | `#4A2C1D` (espresso) | caramelo 45% + creme |

## Frutos de café (vinheta "Mede")

Iguais nos dois temas.

| Fruto | Hex |
|---|---|
| Cereja | `#A2412F` |
| Verde | `#4F8A4A` |
| Amarelo | `#D3A23A` |
| Passa | `#6E4630` |

## Cores da equipe (avatares)

Texto creme por cima, contraste ≥ 4,5:1.

| Pessoa | Hex |
|---|---|
| Gabriel | `#2F5F86` |
| Pedro | `#4A2C1D` |
| Marcos | `#7A3F7A` |
| Lucas Pinotti | `#3F6B4A` |
| Henrique | `#8F4A1F` |
| Prof. Leomar | `#5A5048` |

## Tipografia

| Família | Pesos | Uso |
|---|---|---|
| **Sora** | 600, 700 | Títulos (nunca em texto longo) |
| **Public Sans** | 400, 500, 600 | Texto, botões, formulários |
| **JetBrains Mono** | 400, 500 | Rótulos, dados, datas, coordenadas |

Todas pelo Google Fonts (`next/font`), com `display: swap`.

| Estilo | Fonte | Tamanho / altura de linha | Peso |
|---|---|---|---|
| Display (só o hero) | Sora | `clamp(2.5rem, 6vw, 4rem)` / 1.05, `letter-spacing: -0.02em` | 700 |
| H1 | Sora | 2.25rem / 1.15 | 700 |
| H2 | Sora | 1.625rem / 1.2 (2rem nas seções do site) | 600 |
| H3 | Sora | 1.25rem / 1.3 | 600 |
| Texto | Public Sans | 1.0625rem / 1.65 (site) · 0.9375rem / 1.5 (painel) | 400 |
| Pequeno | Public Sans | 0.8125rem / 1.4 | 500 |
| Rótulo | JetBrains Mono | 0.75rem, MAIÚSCULAS, `letter-spacing: 0.08em` | 500 |
| Dado | JetBrains Mono | herdado, `tabular-nums` | 400 |

Títulos com `text-wrap: balance`. Parágrafos com no máximo 68 caracteres de largura.

## Espaço, grade e formas

- Escala de espaçamento (px): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Site: contêiner de até 1200 px, margem lateral mínima de 16 px; seções com 96 px de espaço vertical (64 px no celular).
- Painel: grade de 8 px, barra lateral de 248 px (64 px recolhida), conteúdo até 1400 px.

| Token | Valor | Uso |
|---|---|---|
| `--raio-p` | 6 px | Chips, campos |
| `--raio-m` | 10 px | Cartões, botões |
| `--raio-g` | 16 px | Blocos do site, fotos |
| `--sombra-cartao` | `0 1px 2px rgb(74 44 29 / .06), 0 2px 8px rgb(74 44 29 / .05)` | Só cartões arrastáveis e flutuantes |
| `--sombra-flutuante` | `0 8px 24px rgb(74 44 29 / .14)` | Menus, cartão flutuante, toast |

Cartões: borda 1 px `--linha`, fundo `--superficie`, raio `--raio-m`. Sem borda colorida lateral.

## Componentes

| Componente | Regra |
|---|---|
| Botão primário | Fundo `--botao-primario`, texto `--botao-primario-texto`, Public Sans 600, altura 44 px (site) / 36 px (painel) |
| Botão secundário | Borda 1 px `--texto`, fundo transparente, hover `--superficie-2` |
| Botão fantasma | Sem borda, texto `--texto-2`, hover `--superficie-2` |
| Botão sobre espresso | Fundo creme, texto espresso |
| Link | `--link`, sublinhado com `text-underline-offset: 3px` |
| Foco | `outline: 2px solid var(--foco); outline-offset: 2px` em tudo que é interativo |
| Campo | Altura 40 px, borda `--linha`, raio 6 px, rótulo sempre visível acima, erro em `--erro` com ícone |
| Chip | Altura 22 px, pílula, ponto de 6 px à esquerda, sempre com texto |
| Ícones | Lucide, traço 1,75 px; 22 px no site, 18 px no painel |

## Elementos gráficos

1. **Curvas de nível**: linhas finas (1 px) em caramelo com transparência, geradas uma vez (`scripts/gerar-curvas.mjs`). Fundo do hero, rodapé e chamada final. Nunca atrás de texto pequeno.
2. **Mapa de produtividade** (hero): as curvas de nível do fundo atravessam a lavoura, e as faixas entre elas ganham as 5 cores de produção aos poucos, sem contorno de lavoura, até a mancha mais forte, marcada com um anel e um ponto. Legenda "Baixa → Alta" e o rótulo "Mapa ilustrativo" (`scripts/gerar-produtividade.mjs`).
3. **Grade de talhões**: retângulos irregulares nas 5 faixas, para a seção "O que você passa a ver" e a vinheta "Mapeia".
4. **Pilha de camadas**: a mesma lavoura em placas deitadas. De baixo para cima: solo e adubação (pontos de amostragem e zonas de dose, em texto-2), irrigação (mangueiras de gotejo e adutora em `--agua`), satélite ou drone (pés de café em fileiras, coloridos pelo vigor, em `--ndvi-1` a `--ndvi-5`, do vermelho ao verde, como nos mapas de verdade) e, no alto, a colheita nas cores de produção. Sem o MoCCa, a placa da colheita fica só tracejada, com uma interrogação. As placas usam `--camada` (`--superficie` no claro, `--superficie-2` no escuro). As cores do vigor e da água são físicas e iguais nos dois temas (o azul fica um pouco mais claro no escuro), como as cores dos frutos.
5. **Símbolo**: o grão com pin só aparece como logo (cabeçalho, rodapé, ícone do navegador e barra lateral recolhida do painel). Não é usado como marcador em mapas, listas, passos ou estados vazios: nos mapas, a posição é um anel com um ponto; nas listas, um ponto caramelo (pedido do Pedro).
6. **Coordenadas**: `21°14′S 44°59′W` (Lavras, MG) em JetBrains Mono, como detalhe.

Fotos: reais, cantos de 16 px, sem filtros fortes. Nada de banco de imagens genérico.

## Movimento

- Transições de 150 a 200 ms, `ease-out`.
- Hero parado.
- Animação só onde explica o funcionamento: vinheta "Mede" (esteira andando e laser mapeando o café).
- Exceção: ao passar o mouse na logo do site, o grão abre (as metades se afastam na direção do vinco) e o pin cresce 18% a partir da ponta, com um leve repique (240 ms). Não vale em telas de toque.
- Tudo desligado com `prefers-reduced-motion: reduce`.

## Texto e tom

- Português do Brasil. Direto, concreto, frases curtas, de quem conhece o campo.
- O MoCCa é um **projeto** da equipe da UFLA, nunca "startup" ou "empresa".
- **Não citar o sensor** (nem marca, nem tipo): falar em "tecnologia instalada na colhedora" ou "equipamento".
- Estágio honesto: "protótipo em desenvolvimento", "em validação com produtores".
- Sem números inventados; ilustrações sempre marcadas como ilustrativas.
- Sem emoji.
- Termos do café usados corretamente: talhão, safra, saca de 60 kg, colhedora, derriça, café cereja, verde, passa, boia, beneficiado.
