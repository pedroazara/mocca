# Site do MoCCa com painel da equipe: especificação para implementação

Versão 1.0 · 29/10/2026 · autor: Pedro Henrique (equipe MoCCa, UFLA)

Este documento é a fonte única de verdade para construir o site. Foi escrito para ser entregue a um agente de IA de programação. Os arquivos da logo estão em `assets/logo/`, ao lado deste arquivo.

---

## 0. Instruções para o agente que vai implementar

1. Leia o documento inteiro antes de escrever código.
2. Siga a ordem de fases da seção 14. Termine e teste uma fase antes de começar a próxima.
3. Quando algo aqui estiver marcado com `[PREENCHER]`, use o valor de exemplo indicado e deixe um comentário `// TODO(pedro):` no código. Não invente dados reais (nomes de produtores, números de safra, preços, parceiros).
4. Quando este documento e uma boa prática entrarem em conflito, siga o documento e registre a dúvida no arquivo `DUVIDAS.md` na raiz do repositório.
5. Todo texto visível ao usuário é em português do Brasil.
6. Não use emoji em nenhuma interface. Ícones vêm da biblioteca Lucide.
7. Escreva um `README.md` com: como rodar localmente, variáveis de ambiente, como aplicar as migrações do banco, como fazer deploy e como gerar o token da API para o Claude.
8. Cada fase termina com os critérios de aceite da seção 14 conferidos, um por um.

---

## 1. Contexto do projeto

**MoCCa (Monitoramento de Colheita de Café)** é um projeto de uma equipe de estudantes de engenharia da Universidade Federal de Lavras (UFLA), com orientação de um professor do Departamento de Física. O sistema mede o volume de café colhido e grava onde cada volume foi colhido (georreferenciamento). O resultado é um mapa de produção talhão por talhão. Além do volume, a equipe estuda estimar sacas, maturação e tamanho do fruto.

A equipe participa do **Avança Café**, programa de pré-aceleração de 12 semanas coordenado pela Embrapa Café e executado pela UFV (tecnoPARQ) e pela UFLA (LavrasTec).

### 1.1 Regras de linguagem (obrigatórias em todo texto do site)

| Regra | Certo | Errado |
|---|---|---|
| O MoCCa não é empresa | "projeto", "equipe da UFLA" | "startup", "empresa", "nossa companhia" |
| Não nomear o sensor | "sensor de profundidade" | qualquer marca ou modelo de câmera/sensor, "Kinect" |
| Estágio honesto | "protótipo em desenvolvimento", "em validação com produtores" | "produto disponível", "compre agora", "líder de mercado" |
| Sem abertura genérica | "No fim da safra, o cafeicultor sabe quantas sacas colheu na fazenda inteira. O que ele não sabe é de onde elas vieram." | "Hoje a maioria dos produtores enfrenta desafios..." |
| Sem números inventados | Números só com fonte, ou marcados como ilustração | "Aumente sua produtividade em 30%" |
| Não citar interessados | Não citar empresas ou produtores que procuraram a equipe | "A empresa X já quer o MoCCa" |
| Público e privado | Dados do painel nunca aparecem no site público | |

### 1.2 Equipe

| Pessoa | Formação | Frente principal | Papel no painel |
|---|---|---|---|
| Gabriel Leonardo | Engenharia Física | Estratégia e gestão, relacionamento com compradores | membro |
| Pedro Henrique | Engenharia Física | Tecnologia e operações, organização das tarefas | admin |
| Marcos Ferreira | Engenharia Física | Marketing, divulgação, identidade visual | membro |
| Lucas Pinotti | Engenharia Física | Execução prática, testes | membro |
| Henrique Perez | Engenharia Mecânica | Protótipos, modelagem 3D | membro |
| Prof. Leomar Santos | Departamento de Física, UFLA | Orientador | orientador (somente leitura + comentários) |

E-mails: `[PREENCHER]`. Use `nome.sobrenome@exemplo.com` nos seeds até o Pedro preencher.

---

## 2. Escopo

O projeto tem duas partes no mesmo código e no mesmo domínio:

1. **Site público** (`/`): apresenta o MoCCa para produtores, fabricantes de máquinas, mentores, a universidade e o programa. Tem um formulário de contato.
2. **Painel da equipe** (`/painel`): área restrita por login. Gestão de tarefas, semanas do programa, reuniões, documentos do Google Drive e contatos recebidos pelo site. Também expõe uma API e um servidor MCP para o Claude criar e atribuir tarefas.

### 2.1 Fora do escopo desta versão

- Loja, preços, pagamentos ou cadastro de clientes.
- Blog com editor próprio (pode entrar depois).
- App mobile nativo (o painel deve funcionar bem no celular pelo navegador).
- Exibir dados reais de colheita ou mapas reais de fazendas.
- Integração bidirecional com o Trello (só importação única, seção 12).
- Notificações por WhatsApp.

---

## 3. Stack e arquitetura

| Camada | Escolha | Observação |
|---|---|---|
| Framework | **Next.js 15** (App Router) + **TypeScript** estrito | Páginas públicas geradas estaticamente; painel renderizado no servidor |
| Estilo | **Tailwind CSS 4** com os tokens da seção 4 como variáveis CSS | Nada de cores literais nos componentes |
| Componentes | **shadcn/ui** (Radix) customizado com os tokens | Botões, diálogos, dropdowns, toasts, tabelas |
| Ícones | **lucide-react** | Traço 1,75 px, tamanho 18 px no painel, 22 px no site |
| Arrastar e soltar | **@dnd-kit/core** + **@dnd-kit/sortable** | Quadro kanban |
| Banco e login | **Supabase** (Postgres, Auth com Google, Row Level Security) | Plano gratuito |
| Formulários | **react-hook-form** + **zod** | Validação no cliente e no servidor com o mesmo schema |
| Datas | **date-fns** com locale `pt-BR`, fuso `America/Sao_Paulo` | Gravar em UTC, exibir em horário de Brasília |
| Anti-spam | **Cloudflare Turnstile** no formulário de contato | Gratuito |
| E-mail (fase 4) | **Gmail** (SMTP com senha de app) | Aviso de tarefa atribuída, confirmação de contato e lembretes de prazo |
| MCP | **@modelcontextprotocol/sdk** em rota HTTP do próprio Next.js | Seção 11 |
| Hospedagem | **Vercel** (plano gratuito), deploy a cada push na `main` | Prévia por pull request |
| Testes | **Vitest** (lógica) + **Playwright** (fluxos principais) | Seção 13 |

### 3.1 Estrutura de pastas

```
/app
  /(publico)
    layout.tsx            cabeçalho e rodapé públicos
    page.tsx              Início
    como-funciona/page.tsx
    equipe/page.tsx
    contato/page.tsx
    privacidade/page.tsx
  /painel
    layout.tsx            barra lateral, barra superior, guarda de login
    page.tsx              Visão da semana (início do painel)
    minhas-tarefas/page.tsx
    quadro/page.tsx
    tarefas/[id]/page.tsx
    semanas/page.tsx
    semanas/[numero]/page.tsx
    reunioes/page.tsx
    reunioes/[id]/page.tsx
    contatos/page.tsx
    equipe/page.tsx
    configuracoes/page.tsx
  /entrar/page.tsx        tela de login
  /acesso-negado/page.tsx
  /api
    /contato/route.ts     POST público com Turnstile
    /v1/...               API REST para o Claude (seção 11)
    /mcp/route.ts         servidor MCP (seção 11)
/components
  /publico                componentes só do site
  /painel                 componentes só do painel
  /ui                     shadcn customizado
/lib
  supabase/               clientes server e browser
  tokens.ts               tokens de design em TS (espelho do CSS)
  validacao/              schemas zod compartilhados
/supabase
  /migrations             SQL da seção 10
  seed.sql                seção 10.4
/public
  /logo                   arquivos de assets/logo
```

### 3.2 Separação entre público e painel

- O grupo de rotas `(publico)` não importa nada de `/components/painel` nem consulta tabelas do painel.
- `middleware.ts` protege tudo sob `/painel` e `/api/v1`: sem sessão, redireciona para `/entrar?volta=<rota>`; com sessão de e-mail fora da lista `pessoa` ativa, redireciona para `/acesso-negado` e encerra a sessão.
- A proteção real fica no banco (RLS, seção 10.3). A interface nunca é a única barreira.
- `/painel/*` responde com `X-Robots-Tag: noindex, nofollow`. `robots.txt` bloqueia `/painel`, `/entrar` e `/api`.
- O site público não tem link visível para o painel no menu. Só um link discreto "Área da equipe" no rodapé.

### 3.3 Variáveis de ambiente

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        só no servidor
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
GMAIL_APP_PASSWORD=               fase 4
NEXT_PUBLIC_SITE_URL=https://[PREENCHER].vercel.app
```

---

## 4. Identidade visual

### 4.1 Conceito

A logo é um grão de café com um pin de localização no centro e curvas de nível nas duas metades: o grão é a colheita, o pin é o lugar onde ela aconteceu, as curvas são a lavoura. O site inteiro segue essa ideia. É a linguagem de um **mapa de lavoura**: curvas de nível, grade de talhões, coordenadas, pontos de localização. As cores vêm do café torrado (espresso, caramelo, creme). O resultado deve parecer um instrumento de agricultura de precisão feito por gente que conhece a lavoura, e não um site genérico de tecnologia.

### 4.2 Arquivos da logo (em `assets/logo/`)

| Uso | Arquivo |
|---|---|
| Cabeçalho do site e do painel (fundo claro) | `mocca-logo-horizontal.svg` |
| Cabeçalho no tema escuro | `mocca-logo-horizontal-fundo-escuro.svg` |
| Hero, página Equipe, materiais | `mocca-logo-vertical.svg` / `-fundo-escuro.svg` |
| Barra lateral recolhida, carregamento, marca d'água | `mocca-simbolo.svg` / `-fundo-escuro.svg` |
| Gravação, carimbo, aplicações numa cor só | `mocca-simbolo-mono.svg` |
| Favicon, ícone de PWA, `apple-touch-icon` | `mocca-icone-app.svg` / `.png` |

Regras:

- Os SVGs têm o texto em curvas. Não redesenhe a logo em código e não troque a fonte dela. Exceção: o símbolo animado do site, que usa a geometria de `components/publico/logo-dados.ts`.
- Altura mínima da logo horizontal: 28 px. Símbolo sozinho: 20 px.
- Área de respiro em volta da logo: no mínimo a altura do "o" de MoCCa em todos os lados.
- Não aplicar sombra, contorno, gradiente, rotação ou cores fora da paleta na logo.
- Trocar a versão clara pela escura conforme o tema (seção 4.4), usando `<picture>` ou duas imagens com classes de tema.
- Gerar `favicon.ico` (16, 32, 48), `icon.png` 512 e `apple-icon.png` 180 a partir de `mocca-icone-app.png`.

### 4.3 Paleta

Cores da marca (da logo, não alterar):

| Nome | Hex | Uso |
|---|---|---|
| Espresso | `#4A2C1D` | Títulos, botão primário, rodapé, "Mo" e "a" da logo, metade de baixo do grão |
| Caramelo | `#B9733F` | Destaques grandes, ícones, gráficos, bordas de foco |
| Caramelo (texto) | `#96592A` | Links e texto pequeno em caramelo, metade de cima do grão, "CC" da logo |
| Marrom-torra | `#8A5A3B` | Texto secundário de marca, subtítulos |
| Creme | `#F6F1E7` | Fundo principal do tema claro |
| Vermelho | `#771900` | Só o pin da logo |

**Atenção de contraste:** caramelo `#B9733F` sobre creme dá 3,3:1. Serve para ícones, elementos gráficos e texto acima de 24 px, **não** para texto pequeno nem para texto de botão. Para links e texto pequeno em caramelo use `--caramelo-texto` `#96592A` (5,0:1).

### 4.4 Tokens (copiar para `app/globals.css`)

```css
:root {
  /* marca */
  --espresso: #4A2C1D;
  --caramelo: #B9733F;
  --caramelo-texto: #96592A;
  --torra: #8A5A3B;
  --creme: #F6F1E7;
  --vermelho: #771900;       /* pin da logo */

  /* superfícies e texto (tema claro) */
  --fundo: #F6F1E7;          /* creme */
  --superficie: #FFFCF7;     /* cartões, painéis */
  --superficie-2: #EFE6DA;   /* cabeçalho de tabela, hover */
  --linha: #E3D6C5;          /* bordas, divisórias */
  --texto: #2B1A11;          /* 14,8:1 no fundo */
  --texto-2: #6E5444;        /* 6,2:1 no fundo */
  --link: #96592A;
  --foco: #B9733F;

  /* botões */
  --botao-primario: #4A2C1D;
  --botao-primario-texto: #F6F1E7;
  --botao-primario-hover: #5E3A27;

  /* estados (semânticas, separadas da marca) */
  --ok: #3F7A4A;      --ok-fundo: #E1EEDF;
  --alerta: #8F6210;  --alerta-fundo: #F5E8C8;
  --erro: #A2412F;    --erro-fundo: #F5DED7;
  --info: #2F5F86;    --info-fundo: #DDE8F1;

  /* etiquetas das tarefas (seção 9.3) */
  --et-entregas: #A2412F;
  --et-validacao: #2F5F86;
  --et-tecnico: #3F7A4A;
  --et-negocio: #8F6210;
  --et-marketing: #7A3F7A;

  /* tipografia */
  --fonte-titulo: "Sora", "Segoe UI", system-ui, sans-serif;
  --fonte-texto: "Public Sans", "Segoe UI", system-ui, sans-serif;
  --fonte-dado: "JetBrains Mono", ui-monospace, Consolas, monospace;

  /* raio e sombra */
  --raio-p: 6px;   /* chips, inputs */
  --raio-m: 10px;  /* cartões, botões */
  --raio-g: 16px;  /* blocos do site público */
  --sombra-cartao: 0 1px 2px rgb(74 44 29 / 0.06), 0 2px 8px rgb(74 44 29 / 0.05);
  --sombra-flutuante: 0 8px 24px rgb(74 44 29 / 0.14);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-tema="claro"]) { /* mesmos valores do bloco abaixo */ }
}
:root[data-tema="escuro"] {
  --fundo: #1A120D;
  --superficie: #241912;
  --superficie-2: #2F2118;
  --linha: #3B2B21;
  --texto: #F3E9DC;          /* 15,4:1 */
  --texto-2: #B79E8A;        /* 7,3:1 */
  --link: #D49360;
  --foco: #D49360;
  --caramelo: #D49360;
  --botao-primario: #D49360;
  --botao-primario-texto: #1A120D;
  --botao-primario-hover: #E0A676;
  --ok: #8CC795;     --ok-fundo: #20311F;
  --alerta: #E3B862; --alerta-fundo: #362B14;
  --erro: #E58B78;   --erro-fundo: #3A211B;
  --info: #8DB8DD;   --info-fundo: #1C2A36;
  --et-entregas: #E58B78; --et-validacao: #8DB8DD; --et-tecnico: #8CC795;
  --et-negocio: #E3B862;  --et-marketing: #D39BD3;
  color-scheme: dark;
}
```

O bloco do `@media` deve repetir exatamente os valores de `[data-tema="escuro"]`. O tema segue o sistema por padrão; o cabeçalho do site tem um botão que alterna entre claro e escuro, e o painel tem um seletor Claro / Escuro / Sistema em Configurações (salvo em `localStorage` e aplicado em `<html data-tema>` antes da pintura, para não piscar).

### 4.5 Tipografia

Carregar pelo `next/font/google`: **Sora** (600, 700), **Public Sans** (400, 500, 600), **JetBrains Mono** (400, 500).

| Estilo | Fonte | Tamanho / altura de linha | Peso | Uso |
|---|---|---|---|---|
| Display | Sora | clamp(2.5rem, 6vw, 4rem) / 1.05, `letter-spacing: -0.02em` | 700 | Só o título do hero |
| H1 | Sora | 2.25rem / 1.15 | 700 | Título de página pública |
| H2 | Sora | 1.625rem / 1.2 | 600 | Seções do site, título de página do painel |
| H3 | Sora | 1.25rem / 1.3 | 600 | Cartões, subtítulos |
| Texto | Public Sans | 1.0625rem / 1.65 (site), 0.9375rem / 1.5 (painel) | 400 | Corpo |
| Pequeno | Public Sans | 0.8125rem / 1.4 | 500 | Metadados, ajuda |
| Rótulo | JetBrains Mono | 0.75rem, maiúsculas, `letter-spacing: 0.08em` | 500 | Sobretítulos, rótulos de dados, cabeçalho de tabela |
| Dado | JetBrains Mono | herdado, `font-variant-numeric: tabular-nums` | 400 | Datas, contagens, coordenadas, IDs |

Regras: títulos com `text-wrap: balance`; parágrafos com no máximo 68 caracteres de largura; nunca usar Sora em textos longos.

### 4.6 Espaço, grade e formas

- Escala de espaçamento (px): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Site público: contêiner de no máximo 1200 px, margem lateral mínima de 16 px (`max(16px, env(safe-area-inset-left))`), seções com 96 px de espaço vertical no desktop e 64 px no celular.
- Painel: grade de 8 px, barra lateral de 248 px (64 px recolhida), conteúdo com no máximo 1400 px.
- Cartões: borda 1 px `--linha`, fundo `--superficie`, raio `--raio-m`, sombra `--sombra-cartao` só em cartões arrastáveis e flutuantes. Não colocar borda colorida lateral nos cartões.

### 4.7 Elementos gráficos próprios

Estes elementos são a assinatura visual. Desenhar em SVG inline usando as cores dos tokens:

1. **Curvas de nível**: linhas finas (1 px, `--linha` ou caramelo a 25% de opacidade) em formas orgânicas concêntricas, como num mapa topográfico. Usar como fundo do hero e do rodapé, nunca atrás de texto pequeno. Gerar as curvas uma vez (SVG estático), não animar continuamente.
2. **Grade de talhões**: retângulos irregulares lado a lado, preenchidos em 5 tons do creme ao espresso, como um mapa de produção. É a ilustração principal do hero e da seção "O que você passa a ver". Os valores são **ilustrativos** e a ilustração leva a legenda "Mapa ilustrativo".
3. **Pin**: o símbolo da logo usado como marcador em listas, no passo a passo e nos estados vazios do painel.
4. **Coordenadas**: pequenos textos em JetBrains Mono como `21°14′S 44°59′W` (coordenada de Lavras, MG) usados como detalhe em sobretítulos e no rodapé.

### 4.8 Imagens

- Fotos reais da equipe, do protótipo e da lavoura, quando houver. `[PREENCHER]`: até lá, usar blocos de placeholder com fundo `--superficie-2`, o símbolo da logo ao centro e o texto "Foto: [descrição]".
- Nada de banco de imagens genérico (pessoas apontando para tablets, drones brilhando).
- Fotos com cantos `--raio-g`, sem filtros fortes. Sempre com `alt` descritivo.

### 4.9 Movimento

- Transições de 150 a 200 ms com `ease-out` em hover, foco e abertura de painéis.
- Uma única animação de entrada no hero: os talhões da grade surgem em sequência (stagger de 40 ms), começando já visíveis com opacidade 0,4 (a página nunca fica vazia antes da animação).
- Arrastar cartão no kanban: o cartão levanta com `--sombra-flutuante` e rotação de 1,5°.
- Tudo desligado com `prefers-reduced-motion: reduce`.

### 4.10 Tom de voz

Direto, concreto, de quem conhece o campo. Frases curtas. Exemplos e cenas em vez de adjetivos. Termos do café usados corretamente: talhão, safra, saca de 60 kg, colhedora, derriça, café cereja, verde, passa, boia, beneficiado. No painel, os textos de botão dizem exatamente o que fazem ("Criar tarefa", "Atribuir", "Marcar como feita").

---

## 5. Componentes compartilhados

| Componente | Especificação |
|---|---|
| Botão primário | Fundo `--botao-primario`, texto `--botao-primario-texto`, Public Sans 600, altura 44 px (site) / 36 px (painel), raio `--raio-m`. Hover `--botao-primario-hover`. |
| Botão secundário | Borda 1 px `--texto`, fundo transparente. Hover `--superficie-2`. |
| Botão fantasma | Sem borda, texto `--texto-2`, hover `--superficie-2`. Usado em ações de linha. |
| Link | `--link`, sublinhado com `text-underline-offset: 3px`. |
| Foco | `outline: 2px solid var(--foco); outline-offset: 2px` em todo elemento interativo. Nunca remover. |
| Campo de texto | Altura 40 px, borda `--linha`, raio `--raio-p`, fundo `--superficie`. Rótulo sempre visível acima (não usar só placeholder). Erro em `--erro` abaixo do campo com ícone. |
| Chip de etiqueta | Altura 22 px, raio 999 px, fundo da cor da etiqueta a 14% de opacidade, texto na cor da etiqueta, ponto de 6 px à esquerda. |
| Avatar | Círculo com iniciais (Sora 600) sobre a cor da pessoa (seção 9.4). Tamanhos 20, 28 e 40 px. Pilha de avatares sobrepostos em −6 px com borda 2 px `--superficie`. |
| Toast | Canto inferior direito, `--superficie` com `--sombra-flutuante`. Ação de "Desfazer" por 6 s em exclusões e movimentações. |
| Estado vazio | Símbolo da logo em `--linha` (48 px), uma frase do que vai aparecer ali e o botão para criar o primeiro item. |
| Carregamento | Esqueletos com `--superficie-2`, sem spinners de página inteira. |

---

## 6. Site público

### 6.1 Cabeçalho

- Logo horizontal à esquerda (link para `/`).
- Menu à direita: Como funciona · Equipe · Contato. Botão primário "Fale com a equipe" (leva para `/contato`).
- Fixo no topo ao rolar, com fundo `--fundo` a 90% e `backdrop-filter: blur(8px)` e borda inferior `--linha` só depois de rolar 8 px.
- No celular (< 768 px): logo + botão de menu que abre uma folha em tela cheia com os links em Sora 600 tamanho 1.5rem.

### 6.2 Rodapé

- Fundo `--espresso`, texto `--creme` (no tema escuro, fundo `#120C08`).
- Curvas de nível ao fundo em creme a 8%.
- Colunas: (1) logo para fundo escuro + frase "Monitoramento de colheita de café, talhão por talhão." (2) Navegação. (3) "Universidade Federal de Lavras · Lavras, MG" + coordenada `21°14′S 44°59′W` em JetBrains Mono. (4) Link discreto "Área da equipe" → `/entrar`.
- Linha final: "© 2026 Equipe MoCCa · UFLA" e link "Privacidade".
- Logos de UFLA, Embrapa Café e Avança Café: **só depois de autorização** `[PREENCHER]`. Até lá, apenas texto.

### 6.3 Página Início (`/`)

Seções em ordem:

**1. Hero**
- Sobretítulo (Rótulo): `MONITORAMENTO DE COLHEITA DE CAFÉ`
- Título (Display): "Cada saca tem um endereço."
- Texto: "No fim da safra, o cafeicultor sabe quantas sacas colheu na fazenda inteira. O que ele não sabe é de onde elas vieram. O MoCCa mede o café enquanto ele é colhido e guarda onde cada volume saiu, talhão por talhão."
- Botões: primário "Veja como funciona" (→ `/como-funciona`), secundário "Fale com a equipe" (→ `/contato`).
- À direita (abaixo no celular): ilustração da grade de talhões (4.7) com legenda "Mapa ilustrativo". Fundo da seção com curvas de nível.
- Altura definida pelo conteúdo, não `100vh`.

**2. O problema** (fundo `--superficie`)
- Título H2: "A média esconde o talhão fraco."
- Texto curto: o total da safra mistura áreas boas e ruins; sem saber de onde veio cada saca, adubação, renovação e manejo são decididos às cegas.
- Três blocos lado a lado (empilham no celular), cada um com ícone Lucide e duas linhas:
  - `MapPinOff` · "Sem endereço" · "O volume chega ao terreiro sem registro de onde foi colhido."
  - `Scale` · "Só o total" · "O caderno e a planilha guardam a soma da safra, não o mapa."
  - `Sprout` · "Decisão no escuro" · "Investir no talhão errado custa a safra seguinte."
- Sem números na seção, a menos que o Pedro forneça com fonte `[PREENCHER]`.

**3. Como funciona (resumo)**
- Título H2: "Medir enquanto colhe."
- Passo a passo horizontal com 3 etapas, conectadas por uma linha pontilhada e o pin como marcador. A numeração aqui é legítima, porque é uma sequência real:
  1. "Mede" · "Um sensor de profundidade instalado na colhedora mede o volume de café que passa."
  2. "Localiza" · "Cada medida recebe a posição por GPS."
  3. "Mapeia" · "O volume vira um mapa de produção por talhão."
- Link "Detalhes técnicos →" para `/como-funciona`.

**4. O que você passa a ver**
- Título H2: "O mapa que faltava na lavoura."
- Ilustração grande da grade de talhões com legenda de 5 faixas (baixa → alta produção) e um cartão flutuante sobre um talhão mostrando, em JetBrains Mono: `Talhão 07 · volume colhido: [ilustrativo]`. Legenda: "Mapa ilustrativo. Dados reais virão dos testes de campo."
- Ao lado, lista com o pin como marcador: "Volume colhido por área", "Localização de cada medida", "Estimativa de sacas", "Em estudo: maturação e tamanho do fruto".

**5. Para quem**
- Dois cartões:
  - "Produtores" · "Para saber quais talhões rendem mais e decidir onde investir."
  - "Fabricantes e locadoras de máquinas" · "Para entregar a colhedora com mapa de produção, como já acontece em grãos."

**6. Estágio do projeto** (fundo `--superficie`)
- Título H2: "Onde estamos."
- Linha do tempo vertical, com status em chip:
  - "Protótipo funcional de medição de volume" · chip `concluído` (ok)
  - "Pesquisa com cafeicultores de Minas Gerais" · chip `concluído`
  - "Pré-aceleração no programa Avança Café" · chip `em andamento` (info)
  - "Testes de campo na safra 2027" · chip `planejado` (neutro) `[PREENCHER: confirmar]`

**7. Chamada final**
- Fundo `--espresso`, texto creme, curvas de nível.
- Título: "Quer testar o MoCCa na sua lavoura?"
- Texto: "Estamos procurando produtores e parceiros para os testes de campo."
- Botão (no fundo escuro: fundo creme, texto espresso): "Fale com a equipe".

### 6.4 Página Como funciona (`/como-funciona`)

- H1: "Como o MoCCa mede a colheita"
- Seções: (1) Onde o equipamento fica na colhedora (diagrama SVG simples da colhedora com o ponto de medição marcado pelo pin; placeholder até haver desenho real `[PREENCHER]`). (2) O que é medido: volume, posição, horário. (3) Como o volume vira sacas: explicar que o fator de conversão muda com a maturação e que a equipe estuda usar imagem para isso. (4) Do campo ao mapa: fluxo em 4 passos (medição → envio → processamento → mapa). (5) Perguntas frequentes em acordeão: "Funciona em qualquer colhedora?", "Precisa de internet no campo?", "Quando estará disponível?", com respostas honestas ("Ainda estamos testando…") `[PREENCHER: Pedro revisar respostas]`.
- Não citar marca ou modelo de sensor em nenhum lugar.

### 6.5 Página Equipe (`/equipe`)

- H1: "Quem está construindo"
- Texto: "Somos estudantes de engenharia da Universidade Federal de Lavras, com orientação do Departamento de Física."
- Grade de cartões (3 colunas no desktop, 2 no tablet, 1 no celular): foto (ou placeholder com iniciais grandes sobre a cor da pessoa), nome em Sora 600, curso em Rótulo, uma frase sobre o que faz no projeto, link opcional para LinkedIn. Foto e LinkedIn são editados no painel (seção 9.8); o cartão acha a pessoa do painel pelo nome.
- Cartão do orientador separado, ao final, com o rótulo `ORIENTADOR`.
- Não citar papéis de negociação/vendas nem detalhar "diplomata".

### 6.6 Página Contato (`/contato`)

- H1: "Fale com a equipe"
- Formulário à esquerda, texto lateral à direita ("Respondemos em até 3 dias úteis. Se você é produtor e quer participar dos testes de campo, conte o tamanho da área e o tipo de colheita.").
- Campos:

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| Nome | texto | sim | 2 a 120 caracteres |
| E-mail | e-mail | sim | formato válido |
| Telefone / WhatsApp | texto | não | máscara brasileira |
| Você é | seleção: Produtor · Fabricante ou revenda de máquinas · Locadora de máquinas · Pesquisador · Imprensa · Outro | sim | |
| Cidade / UF | texto | não | |
| Área de café (ha) | número | só se "Produtor" | 0 a 100000 |
| Tipo de colheita | seleção: Manual · Semimecanizada · Mecanizada · Mista | só se "Produtor" | |
| Mensagem | texto longo | sim | 10 a 3000 caracteres |
| Consentimento | caixa | sim | "Concordo que a equipe MoCCa guarde estes dados para responder ao meu contato." + link Privacidade |

- Turnstile antes do botão "Enviar mensagem".
- `POST /api/contato`: valida com zod, confere o Turnstile, limita a 5 envios por IP por hora, grava em `contato` com o service role e cria automaticamente uma tarefa "Responder contato: {nome}" na semana atual, atribuída ao responsável configurado em Configurações (padrão: Gabriel). Fase 4: envia uma confirmação para quem escreveu, com texto fixo, e um aviso para o responsável.
- Sucesso: substitui o formulário por uma mensagem "Mensagem enviada. Vamos responder no e-mail {email}." com o pin.
- Erro: mensagem clara do que corrigir, sem apagar o que a pessoa digitou.

### 6.7 Página Privacidade (`/privacidade`)

Texto simples conforme a LGPD: quais dados o formulário coleta, para quê, por quanto tempo (até 2 anos), quem acessa (só a equipe), como pedir exclusão (e-mail `[PREENCHER]`).

### 6.8 SEO e compartilhamento

- `<title>` por página no formato "Como funciona · MoCCa". Início: "MoCCa · Monitoramento de colheita de café".
- `description` de até 155 caracteres por página.
- Imagem Open Graph 1200×630 gerada com `next/og`: fundo creme, curvas de nível, logo horizontal, título da página em Sora 700 espresso.
- `sitemap.xml` só com as páginas públicas. `lang="pt-BR"`.
- Metas: Lighthouse ≥ 95 em Performance, Acessibilidade, Boas práticas e SEO nas páginas públicas.

---

## 7. Login e acesso

### 7.1 Tela `/entrar`

- Fundo creme com curvas de nível. Cartão central de 400 px: símbolo da logo, título "Área da equipe", texto "Entre com a conta Google cadastrada na equipe.", botão "Entrar com Google" (ícone do Google oficial monocromático).
- Depois do login, volta para a rota em `?volta=` ou para `/painel`.

### 7.2 Regras

- Login só por Google OAuth (Supabase Auth).
- Um trigger no banco liga `auth.users` à tabela `pessoa` pelo e-mail. Se o e-mail não estiver em `pessoa` com `ativo = true`, o acesso é negado (página `/acesso-negado` com o texto "Este e-mail não faz parte da equipe MoCCa. Peça para o Pedro cadastrar você." e botão "Sair").
- Papéis: `admin` (tudo, inclusive pessoas e configurações), `membro` (cria e edita tarefas, reuniões, documentos; vê contatos), `orientador` (lê tudo, comenta, não edita nem apaga).

---

## 8. Painel: estrutura geral

### 8.1 Layout

- **Barra lateral** (248 px, fundo `--superficie`, borda direita `--linha`):
  - Topo: logo horizontal (símbolo quando recolhida).
  - Itens com ícone Lucide + texto, item ativo com fundo `--superficie-2` e texto `--texto` 600:
    - `CalendarRange` Semana (início)
    - `UserCheck` Minhas tarefas (com contador de abertas)
    - `Columns3` Quadro
    - `Flag` Semanas do programa
    - `MessagesSquare` Reuniões
    - `Inbox` Contatos (com contador de novos)
    - `Users` Equipe
  - Base: `Settings` Configurações (só admin), avatar e nome da pessoa logada com menu (Tema, Sair).
  - Botão para recolher a barra (estado salvo em `localStorage`).
  - No celular (< 1024 px): a barra vira gaveta, e uma barra inferior fixa mostra Semana, Minhas tarefas, Quadro e Mais.
- **Barra superior** (56 px): título da página (H2 do painel em 1.25rem), migalhas quando for detalhe, campo de busca (`Ctrl/Cmd + K` abre a paleta de comandos), botão primário "Nova tarefa" (atalho `N`).

### 8.2 Paleta de comandos (`Ctrl/Cmd + K`)

Busca tarefas por título, pessoas, semanas e reuniões. Ações: "Nova tarefa", "Ir para semana atual", "Minhas tarefas", "Nova reunião", "Alternar tema".

### 8.3 Atalhos de teclado

`N` nova tarefa · `/` busca · `G S` Semana · `G M` Minhas tarefas · `G Q` Quadro · `Esc` fecha painel lateral · Na tarefa aberta: `E` editar título, `A` atribuir, `D` prazo, `Ctrl+Enter` salvar comentário. Lista de atalhos em `?`.

---

## 9. Painel: telas

### 9.1 Semana (`/painel`, tela inicial)

Objetivo: em 10 segundos, saber o que a equipe precisa entregar nesta semana e quem está atrasado.

Topo:
- Seletor de semana: "← Semana 2 de 12 · 27/10 a 02/11 →" (Sora 600 + datas em JetBrains Mono). Abre na semana atual.
- Barra de progresso da semana: tarefas feitas / total, em caramelo, com o número ao lado em tabular.

Bloco 1, **Entrega do programa** (cartão destacado com fundo `--superficie-2`):
- Rótulo `ENTREGA DO AVANÇA CAFÉ`, título da entrega, prazo com contagem ("faltam 3 dias", em `--alerta` quando faltar ≤ 2 dias e `--erro` se atrasada), link do documento no Drive, tarefas ligadas à entrega com status.

Bloco 2, **Por pessoa** (o centro da tela):
- Uma coluna por pessoa da equipe (rolagem horizontal no celular, cada coluna com 280 px). Cabeçalho da coluna: avatar 28 px, nome, contador "3 de 5 feitas".
- Dentro: cartões compactos das tarefas da semana em que a pessoa é responsável ou apoio. Os itens de checklist da própria pessoa aparecem embaixo do título do cartão, com caixas marcáveis ali mesmo.
- Tarefas atrasadas no topo com chip `atrasada` (erro).

Bloco 3, **Atenção**:
- Lista curta: tarefas atrasadas de qualquer semana, tarefas sem responsável, contatos novos sem resposta há mais de 3 dias.

Bloco 4, **Próxima reunião**:
- Data, pauta gerada (seção 9.6) e botão "Abrir pauta".

### 9.2 Minhas tarefas (`/painel/minhas-tarefas`)

- Abas: Abertas · Feitas · Todas.
- Agrupamento: Atrasadas · Esta semana · Próximas semanas · Sem prazo.
- Linha da tarefa: caixa de conclusão, título, chips de etiqueta, semana (`S2`), prazo (dado), avatares dos outros envolvidos, ícone de documento se houver link do Drive, contador de itens "2/4".
- Mostrar os itens de checklist da pessoa logada expandidos sob cada tarefa.
- Filtro por etiqueta e busca.

### 9.3 Quadro (`/painel/quadro`)

- Kanban com 4 colunas fixas: **A fazer** · **Fazendo** · **Em revisão** · **Feito**.
- Filtros no topo (persistem na URL): semana (padrão: atual; opção "Todas"), pessoa, etiqueta, "só atrasadas".
- Cartão do kanban (largura 100% da coluna, padding 12 px):
  - Linha 1: chips de etiqueta.
  - Linha 2: título (Public Sans 500, até 3 linhas).
  - Linha 3: prazo (com cor de estado), ícones de documento e de comentários com contagem, progresso do checklist "3/7", pilha de avatares à direita.
  - Se a tarefa for ligada à entrega do programa: pequeno pin caramelo no canto superior direito.
- Arrastar entre colunas muda o status; arrastar dentro da coluna muda a ordem (campo `posicao`). Atualização otimista com toast "Movida para Fazendo · Desfazer".
- Botão "+ Adicionar tarefa" no fim de cada coluna: cria inline só com título, na semana filtrada.
- Coluna "Feito" mostra só as 20 mais recentes, com link "Ver todas".

Etiquetas fixas (iguais às do Trello atual):

| Etiqueta | Token |
|---|---|
| Entregas | `--et-entregas` |
| Validação do Produto | `--et-validacao` |
| Técnico | `--et-tecnico` |
| Negócio | `--et-negocio` |
| Marketing | `--et-marketing` |

### 9.4 Tarefa (painel lateral e página `/painel/tarefas/[id]`)

Clicar numa tarefa abre um **painel lateral** de 560 px pela direita (tela cheia no celular), com URL própria para poder compartilhar. Conteúdo:

1. **Cabeçalho**: título editável inline (Sora 600, 1.375rem), seletor de status, menu `…` (Duplicar, Mover para semana…, Copiar link, Arquivar).
2. **Propriedades** (grade de rótulo à esquerda e valor à direita):
   - Semana (seletor com as 12 semanas)
   - Prazo (seletor de data; padrão = fim da semana)
   - Etiquetas (multisseleção)
   - Ligada à entrega do programa (caixa)
   - Criada por / origem (`manual`, `reunião`, `Claude`, `contato do site`), só leitura
3. **Descrição**: editor Markdown simples (negrito, itálico, listas, links) com pré-visualização. Aceita colar um roteiro.
4. **Responsáveis e tarefas por pessoa** (o coração da tela, equivalente ao "um checklist por pessoa" do Trello):
   - Um bloco por pessoa atribuída: avatar, nome, seletor de papel (`responsável` / `apoio`), e a lista de itens dela, cada um com caixa, texto editável e arrastar para reordenar.
   - "+ Adicionar item" em cada bloco.
   - Botão "Atribuir pessoa" abre uma lista com as pessoas da equipe; ao escolher, cria o bloco vazio.
   - Remover pessoa pede confirmação inline (não usar `confirm()`).
   - Regra: toda tarefa aberta deve ter pelo menos um `responsável`; sem isso, aparece um aviso amarelo "Sem responsável".
5. **Documentos**: lista de links do Google Drive com ícone por tipo (Doc, Planilha, Apresentação, Pasta, PDF), título e tipo (`roteiro`, `registro`, `síntese`, `entregável`, `outro`). "+ Adicionar documento": cola a URL, o título é preenchido a partir da URL se possível (senão a pessoa digita). Validar que é um link `drive.google.com` ou `docs.google.com`.
6. **Comentários e histórico**: abas "Comentários" e "Histórico". Comentários em Markdown, com menção `@nome`. Histórico automático: criação, mudança de status, atribuição, prazo, conclusão de item (quem e quando).

### 9.5 Semanas do programa (`/painel/semanas`)

- Linha do tempo horizontal das 12 semanas (rolável), cada semana com número, datas, título da entrega e um anel de progresso (feitas/total). Semana atual destacada com borda caramelo.
- Abaixo, a tabela das semanas: número, datas, entrega do programa, link do entregável, status (`não iniciada`, `em andamento`, `entregue`), tarefas abertas.
- Página da semana (`/painel/semanas/[numero]`): mesma visão da tela Semana, fixada naquela semana, com o campo de anotações da semana (Markdown) e o link da aula/mentoria correspondente.
- Admin edita datas, entrega e links.

### 9.6 Reuniões (`/painel/reunioes`)

- Lista de reuniões (data, presentes, número de decisões, link da ata).
- Botão "Nova reunião": cria com a data da próxima reunião fixa (configurável em Configurações: dia da semana e horário `[PREENCHER]`).
- **Pauta gerada automaticamente** ao abrir uma reunião futura, em 4 blocos, cada um com as tarefas como links:
  1. Entrega do programa desta semana e status.
  2. Tarefas atrasadas.
  3. Tarefas concluídas desde a última reunião.
  4. Contatos novos.
- Durante a reunião: campo "Anotações" (Markdown), lista "Decisões" (itens simples) e lista "Tarefas criadas nesta reunião" com botão "+ Nova tarefa" que já marca origem `reunião` e liga à reunião.
- Campo para o link da ata no Drive.

### 9.7 Contatos (`/painel/contatos`)

- Tabela: data, nome, perfil, cidade/UF, área (ha), status (`novo`, `em conversa`, `respondido`, `arquivado`), responsável.
- Clicar abre painel lateral com todos os dados, a mensagem, a tarefa criada automaticamente e um campo de notas internas.
- Filtro por perfil e status. Exportar CSV (gera arquivo para download via rota do servidor).
- Orientador vê, mas não edita.

### 9.8 Equipe (`/painel/equipe`)

- Cartão por pessoa: avatar, nome, frente, papel no painel, tarefas abertas, atrasadas e feitas na semana.
- Clicar leva a uma visão "Tarefas de {nome}" igual a Minhas tarefas.
- Admin: botão "Adicionar pessoa" (nome, e-mail Google, frente, papel, cor, LinkedIn, foto), editar e desativar (nunca apagar; a pessoa some das listas de atribuição, mas o histórico fica).
- Foto e LinkedIn alimentam a página Equipe do site, que se renova ao salvar. A foto é recortada em 4:3 no navegador, com ajuste de enquadramento, e guardada como JPEG no Postgres (tabela `perfil_publico`, servida por `/api/fotos/{id}`).

Cores das pessoas (avatares), todas com texto creme com contraste ≥ 4,5:1:

| Pessoa | Cor |
|---|---|
| Gabriel | `#2F5F86` |
| Pedro | `#4A2C1D` |
| Marcos | `#7A3F7A` |
| Lucas Pinotti | `#3F6B4A` |
| Henrique | `#8F4A1F` |
| Prof. Leomar | `#5A5048` |

### 9.9 Configurações (`/painel/configuracoes`, só admin)

- Dia e horário da reunião semanal.
- Responsável padrão por contatos do site.
- Datas da semana 1 do programa (recalcula as 12 semanas; cada uma pode ser ajustada à mão depois).
- Tokens de API para o Claude: criar (mostra o token uma única vez com botão Copiar), listar (nome, criado em, último uso), revogar.
- Importação do Trello (seção 12).
- Tema: Claro / Escuro / Sistema (também disponível para todos no menu do avatar).

---

## 10. Banco de dados (Supabase / Postgres)

### 10.1 Tipos

```sql
create type papel_painel   as enum ('admin', 'membro', 'orientador');
create type status_tarefa  as enum ('a_fazer', 'fazendo', 'em_revisao', 'feito');
create type origem_tarefa  as enum ('manual', 'reuniao', 'claude', 'contato', 'trello');
create type papel_atrib    as enum ('responsavel', 'apoio');
create type tipo_documento as enum ('roteiro', 'registro', 'sintese', 'entregavel', 'outro');
create type status_semana  as enum ('nao_iniciada', 'em_andamento', 'entregue');
create type perfil_contato as enum ('produtor', 'fabricante', 'locadora', 'pesquisador', 'imprensa', 'outro');
create type status_contato as enum ('novo', 'em_conversa', 'respondido', 'arquivado');
```

### 10.2 Tabelas

```sql
create table pessoa (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique references auth.users(id),
  nome        text not null,
  apelido     text,                       -- usado em menções e pelo Claude: "Pinotti", "Gabriel"
  email       text not null unique,
  frente      text,
  papel       papel_painel not null default 'membro',
  cor         text not null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table semana (
  id                 uuid primary key default gen_random_uuid(),
  numero             int not null unique check (numero between 1 and 12),
  inicio             date not null,
  fim                date not null,
  entrega_titulo     text,
  entrega_prazo      timestamptz,
  entrega_url        text,
  status             status_semana not null default 'nao_iniciada',
  anotacoes          text
);

create table etiqueta (
  id     uuid primary key default gen_random_uuid(),
  nome   text not null unique,
  token  text not null                     -- ex.: 'et-entregas'
);

create table tarefa (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null check (char_length(titulo) between 1 and 200),
  descricao        text,
  status           status_tarefa not null default 'a_fazer',
  posicao          double precision not null default 0,
  semana_id        uuid references semana(id),
  prazo            timestamptz,
  ligada_entrega   boolean not null default false,
  origem           origem_tarefa not null default 'manual',
  reuniao_id       uuid references reuniao(id),
  contato_id       uuid references contato(id),
  trello_id        text unique,
  criado_por       uuid references pessoa(id),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  concluido_em     timestamptz,
  arquivada        boolean not null default false
);

create table tarefa_etiqueta (
  tarefa_id   uuid references tarefa(id) on delete cascade,
  etiqueta_id uuid references etiqueta(id) on delete cascade,
  primary key (tarefa_id, etiqueta_id)
);

create table atribuicao (
  id         uuid primary key default gen_random_uuid(),
  tarefa_id  uuid not null references tarefa(id) on delete cascade,
  pessoa_id  uuid not null references pessoa(id),
  papel      papel_atrib not null default 'responsavel',
  posicao    double precision not null default 0,
  unique (tarefa_id, pessoa_id)
);

create table item (
  id             uuid primary key default gen_random_uuid(),
  atribuicao_id  uuid not null references atribuicao(id) on delete cascade,
  texto          text not null,
  feito          boolean not null default false,
  feito_em       timestamptz,
  posicao        double precision not null default 0
);

create table documento (
  id         uuid primary key default gen_random_uuid(),
  tarefa_id  uuid references tarefa(id) on delete cascade,
  semana_id  uuid references semana(id) on delete cascade,
  titulo     text not null,
  url        text not null check (url ~ '^https://(drive|docs)\.google\.com/'),
  tipo       tipo_documento not null default 'outro',
  criado_em  timestamptz not null default now(),
  check (tarefa_id is not null or semana_id is not null)
);

create table reuniao (
  id          uuid primary key default gen_random_uuid(),
  data        timestamptz not null,
  anotacoes   text,
  ata_url     text,
  criado_em   timestamptz not null default now()
);

create table reuniao_presenca (
  reuniao_id uuid references reuniao(id) on delete cascade,
  pessoa_id  uuid references pessoa(id),
  primary key (reuniao_id, pessoa_id)
);

create table decisao (
  id          uuid primary key default gen_random_uuid(),
  reuniao_id  uuid not null references reuniao(id) on delete cascade,
  texto       text not null,
  posicao     double precision not null default 0
);

create table comentario (
  id         uuid primary key default gen_random_uuid(),
  tarefa_id  uuid not null references tarefa(id) on delete cascade,
  autor_id   uuid not null references pessoa(id),
  texto      text not null,
  criado_em  timestamptz not null default now()
);

create table historico (
  id         bigserial primary key,
  tarefa_id  uuid not null references tarefa(id) on delete cascade,
  autor_id   uuid references pessoa(id),      -- null quando for a API do Claude
  via_api    boolean not null default false,
  acao       text not null,                   -- 'criou', 'status', 'atribuiu', 'desatribuiu', 'prazo', 'item_feito', ...
  detalhe    jsonb,
  criado_em  timestamptz not null default now()
);

create table contato (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  email         text not null,
  telefone      text,
  perfil        perfil_contato not null,
  cidade_uf     text,
  area_ha       numeric,
  tipo_colheita text,
  mensagem      text not null,
  consentiu     boolean not null,
  status        status_contato not null default 'novo',
  responsavel_id uuid references pessoa(id),
  notas         text,
  ip_hash       text,
  criado_em     timestamptz not null default now()
);

create table configuracao (
  id                     int primary key default 1 check (id = 1),
  reuniao_dia_semana     int,      -- 0 = domingo
  reuniao_hora           time,
  responsavel_contato_id uuid references pessoa(id)
);

create table token_api (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,             -- ex.: 'Claude do projeto'
  hash         text not null unique,      -- sha-256 do token; o token em si nunca é guardado
  criado_por   uuid references pessoa(id),
  criado_em    timestamptz not null default now(),
  ultimo_uso   timestamptz,
  revogado     boolean not null default false
);
```

(Ordene a criação para respeitar as chaves estrangeiras: `reuniao` e `contato` antes de `tarefa`.)

Triggers:
- `atualizado_em` em `tarefa` a cada update.
- `concluido_em` preenchido quando `status` vira `feito` e limpo quando sai.
- `historico` gravado por trigger em mudanças de `tarefa.status`, `tarefa.prazo`, `atribuicao` (insert/delete) e `item.feito`.
- Ligação `auth.users` → `pessoa.auth_id` pelo e-mail no primeiro login.

Índices: `tarefa(semana_id, status)`, `tarefa(prazo)`, `atribuicao(pessoa_id)`, `contato(status, criado_em)`.

### 10.3 Regras de acesso (RLS)

Ativar RLS em **todas** as tabelas. Funções auxiliares:

```sql
create function eu() returns pessoa language sql stable security definer as $$
  select * from pessoa where auth_id = auth.uid() and ativo
$$;
create function sou_membro() returns boolean language sql stable as $$
  select exists (select 1 from pessoa where auth_id = auth.uid() and ativo)
$$;
create function posso_editar() returns boolean language sql stable as $$
  select exists (select 1 from pessoa where auth_id = auth.uid() and ativo and papel in ('admin','membro'))
$$;
create function sou_admin() returns boolean language sql stable as $$
  select exists (select 1 from pessoa where auth_id = auth.uid() and ativo and papel = 'admin')
$$;
```

| Tabela | Ler | Criar / editar | Apagar |
|---|---|---|---|
| tarefa, atribuicao, item, documento, tarefa_etiqueta, reuniao, decisao, reuniao_presenca, semana | `sou_membro()` | `posso_editar()` (semana: só admin edita) | `posso_editar()` (preferir arquivar) |
| comentario | `sou_membro()` | qualquer membro, inclusive orientador; editar só o próprio | autor ou admin |
| historico | `sou_membro()` | só triggers | ninguém |
| contato | `sou_membro()` | insert só pelo service role (rota `/api/contato`); update `posso_editar()` | admin |
| pessoa, etiqueta, configuracao | `sou_membro()` | `sou_admin()` | ninguém (desativar) |
| token_api | `sou_admin()` | `sou_admin()` | ninguém (revogar) |

O usuário anônimo (`anon`) não lê nem escreve em nenhuma tabela.

### 10.4 Dados iniciais (`seed.sql`)

- As 6 pessoas da seção 1.2, com as cores da 9.8 e e-mails de exemplo.
- As 5 etiquetas da 9.3.
- 12 semanas, semana 1 começando em **20/10/2026** (`[PREENCHER: confirmar datas e títulos das entregas]`), cada uma com 7 dias. Títulos das entregas como "Entrega da semana N" até o Pedro preencher. A semana 1 tem entregável "Pacote de Tarefas Semana 1".
- Configuração: responsável por contato = Gabriel.
- Nenhuma tarefa de exemplo no banco de produção. Em desenvolvimento, `seed-dev.sql` cria 15 tarefas marcadas `[EXEMPLO]` espalhadas pelas pessoas, status e semanas.

---

## 11. Integração com o Claude

Objetivo: depois da reunião semanal, o Claude lê as anotações e cria as tarefas já atribuídas e com itens por pessoa, sem digitação manual.

### 11.1 Autenticação

- Token gerado em Configurações (formato `mocca_` + 40 caracteres aleatórios). Guardar só o hash SHA-256.
- Enviado como `Authorization: Bearer <token>`.
- As rotas usam o service role do Supabase no servidor, depois de validar o token, e gravam `historico.via_api = true`.
- Limite: 120 requisições por minuto por token.

### 11.2 API REST (`/api/v1`)

Todas respondem JSON, com erros no formato `{ "erro": { "codigo": "...", "mensagem": "..." } }`.

| Método e rota | O que faz |
|---|---|
| `GET /api/v1/pessoas` | Lista pessoas ativas (id, nome, apelido, frente) |
| `GET /api/v1/semanas` | Lista as 12 semanas; `?atual=true` só a atual |
| `GET /api/v1/tarefas` | Filtros: `semana`, `pessoa`, `status`, `etiqueta`, `atrasadas=true` |
| `GET /api/v1/tarefas/{id}` | Tarefa completa com atribuições, itens, documentos |
| `POST /api/v1/tarefas` | Cria tarefa (corpo abaixo) |
| `PATCH /api/v1/tarefas/{id}` | Atualiza título, descrição, status, prazo, semana, etiquetas |
| `POST /api/v1/tarefas/{id}/atribuicoes` | `{ pessoa, papel, itens: [texto] }` |
| `DELETE /api/v1/tarefas/{id}/atribuicoes/{pessoa}` | Remove pessoa |
| `POST /api/v1/tarefas/{id}/itens` | `{ pessoa, texto }` |
| `PATCH /api/v1/itens/{id}` | `{ feito, texto }` |
| `POST /api/v1/tarefas/{id}/documentos` | `{ titulo, url, tipo }` |
| `POST /api/v1/tarefas/{id}/comentarios` | `{ texto }`, autor exibido como "Claude" |
| `GET /api/v1/reunioes/proxima` | Pauta gerada da próxima reunião |

Pessoas podem ser indicadas por `id`, e-mail ou apelido (sem diferenciar maiúsculas e acentos). Se o apelido for ambíguo ou não existir, responder `422` com a lista de pessoas válidas.

Exemplo de criação:

```json
POST /api/v1/tarefas
{
  "titulo": "Entrevistas de disposição a pagar",
  "descricao": "Roteiro no Drive. Meta: 5 entrevistas até sexta.",
  "semana": 2,
  "prazo": "2026-10-31T21:00:00-03:00",
  "etiquetas": ["Validação do Produto"],
  "ligada_entrega": true,
  "origem": "reuniao",
  "atribuicoes": [
    { "pessoa": "Gabriel", "papel": "responsavel",
      "itens": ["Agendar 3 produtores", "Conduzir entrevistas"] },
    { "pessoa": "Marcos", "papel": "apoio",
      "itens": ["Preencher a planilha de registro"] }
  ],
  "documentos": [
    { "titulo": "Roteiro das entrevistas", "url": "https://docs.google.com/document/d/...", "tipo": "roteiro" }
  ]
}
```

### 11.3 Servidor MCP (`/api/mcp`)

Transporte HTTP streamable do MCP, mesmo token Bearer. Ferramentas (nomes em português, descrições claras para o modelo):

| Ferramenta | Entrada | Faz |
|---|---|---|
| `listar_pessoas` | — | Pessoas ativas |
| `listar_semanas` | `{ apenas_atual? }` | Semanas e entregas |
| `listar_tarefas` | `{ semana?, pessoa?, status?, atrasadas? }` | Tarefas resumidas |
| `ver_tarefa` | `{ id }` | Tarefa completa |
| `criar_tarefa` | mesmo corpo do `POST /tarefas` | Cria com atribuições e itens numa transação |
| `atualizar_tarefa` | `{ id, ...campos }` | Edita |
| `atribuir` | `{ tarefa_id, pessoa, papel?, itens? }` | Atribui e cria itens |
| `marcar_item` | `{ item_id, feito }` | Marca item |
| `adicionar_documento` | `{ tarefa_id, titulo, url, tipo? }` | Liga documento do Drive |
| `comentar` | `{ tarefa_id, texto }` | Comenta como "Claude" |
| `pauta_proxima_reuniao` | — | Pauta gerada |

Toda ferramenta que escreve devolve o link da tarefa no painel (`{SITE_URL}/painel/tarefas/{id}`). O README deve explicar como adicionar o servidor como conector personalizado no Claude (URL `{SITE_URL}/api/mcp` + token).

---

## 12. Importação do Trello (uma vez)

Em Configurações: o admin envia o JSON exportado do quadro "Avança Café" (Menu do quadro → Imprimir, exportar e compartilhar → Exportar como JSON).

Mapeamento:

| Trello | Painel |
|---|---|
| Lista "Semana 1", "Semana 2" | `semana_id` da semana correspondente, status `a_fazer` |
| Lista "Em andamento" | status `fazendo` |
| Lista "Finalizados" | status `feito` |
| Lista "Links" | vira documentos da semana 1 (não vira tarefa) |
| Etiquetas | etiquetas de mesmo nome |
| Checklist com nome de pessoa (ex.: "Marcos") | atribuição daquela pessoa com os itens do checklist; o primeiro checklist vira `responsável`, os demais `apoio` |
| Membros do cartão | atribuições sem itens, se ainda não existirem |
| Links `docs.google.com` / `drive.google.com` na descrição | documentos da tarefa |
| Data de entrega | `prazo` |
| `id` do cartão | `trello_id` (reimportar não duplica) |

Antes de gravar, mostrar uma prévia ("23 tarefas, 41 itens, 12 documentos; 2 checklists sem pessoa reconhecida") e pedir confirmação na própria tela.

---

## 13. Qualidade

### 13.1 Acessibilidade (WCAG 2.2 AA)

- Contraste mínimo 4,5:1 para texto e 3:1 para ícones e bordas de campos, nos dois temas (os tokens já foram conferidos; não criar cores fora deles).
- Tudo operável por teclado, inclusive o kanban (dnd-kit com `KeyboardSensor`: espaço pega, setas movem, espaço solta, com anúncios em português para leitores de tela).
- Alvos de toque de no mínimo 44 × 44 px no celular.
- `aria-label` em botões só com ícone. Estados não dependem só de cor (chip "atrasada" tem texto e ícone).
- Formulários com `<label>` ligado ao campo e mensagens de erro ligadas por `aria-describedby`.

### 13.2 Responsividade

Testar em 360, 768, 1024, 1440 px. Nenhuma rolagem horizontal da página, exceto dentro do kanban e da visão por pessoa, que rolam no próprio contêiner.

### 13.3 Desempenho

- Páginas públicas estáticas, imagens com `next/image`, fontes com `display: swap`.
- Painel: atualização otimista em status, itens e ordem; revalidação em segundo plano. Supabase Realtime nas tabelas `tarefa`, `atribuicao` e `item` para que duas pessoas vejam as mudanças uma da outra sem recarregar.

### 13.4 Testes

- Vitest: geração da pauta, cálculo de semana atual, resolução de apelido de pessoa, mapeamento do Trello.
- Playwright: (1) enviar contato pelo site e ver a tarefa criada no painel; (2) login negado para e-mail fora da equipe; (3) criar tarefa, atribuir duas pessoas com itens, marcar item; (4) mover cartão no kanban; (5) criar tarefa pela API com token e ver no painel; (6) orientador não consegue editar.
- Teste de RLS: com a chave `anon`, nenhuma tabela retorna dados.

---

## 14. Fases de entrega

### Fase 1 · Base e site público (estimativa 8–12 h)
Entregas: projeto Next.js, tokens e tema claro/escuro, fontes, componentes base, cabeçalho e rodapé, páginas Início, Como funciona, Equipe, Contato, Privacidade, SEO, deploy na Vercel. Formulário de contato gravando no Supabase.
Aceite:
- [ ] As 5 páginas públicas existem com o conteúdo da seção 6 e funcionam em 360 px.
- [ ] Tema escuro correto sem piscar ao carregar.
- [ ] Nenhuma ocorrência de "startup", "empresa" ou nome de sensor no site.
- [ ] Lighthouse ≥ 95 nas quatro categorias na página Início.
- [ ] Contato enviado aparece na tabela `contato`.

### Fase 2 · Login e painel básico (estimativa 10–14 h)
Entregas: login Google, guarda de acesso, RLS, seeds, layout do painel, telas Semana, Minhas tarefas, Quadro, Tarefa (com atribuições, itens e documentos), Semanas do programa, Equipe.
Aceite:
- [ ] E-mail fora da lista não entra.
- [ ] Criar uma tarefa, atribuir duas pessoas com itens diferentes, e cada pessoa ver só os próprios itens destacados em Minhas tarefas.
- [ ] Kanban move cartões com mouse, toque e teclado.
- [ ] Chave `anon` não lê nada.

### Fase 3 · Reuniões, contatos e Claude (estimativa 8–12 h)
Entregas: Reuniões com pauta gerada, Contatos com tarefa automática, tokens de API, API REST, servidor MCP, importação do Trello, comentários e histórico, Realtime.
Aceite:
- [ ] O Claude, conectado ao MCP, cria uma tarefa com duas pessoas e itens a partir de um texto de reunião, e ela aparece no painel com origem "Claude".
- [ ] Importar o JSON do Trello cria as tarefas sem duplicar ao reimportar.
- [ ] Pauta da próxima reunião lista atrasadas, entrega da semana e contatos novos.

### Fase 4 · Conforto (estimativa 6–10 h, opcional)
Entregas: e-mails de tarefa atribuída, de confirmação de contato e de lembrete na véspera do prazo (Gmail), paleta de comandos, atalhos, exportar contatos em CSV, imagens Open Graph.

---

## 15. Não fazer

- Não usar gradientes roxo/azul, fundos neon, ilustrações 3D genéricas ou emoji.
- Não usar `100vh` no hero.
- Não colocar cores literais em componentes; só tokens.
- Não colocar link visível para o painel no menu público.
- Não guardar tokens de API em texto puro.
- Não permitir apagar pessoas (só desativar) nem apagar histórico.
- Não exibir dados de contatos, tarefas ou reuniões em qualquer página pública.
- Não inventar números de produtividade, clientes, parceiros ou depoimentos.

---

## 16. Pendências para o Pedro preencher

| Item | Onde entra |
|---|---|
| E-mails Google das 6 pessoas | seed de `pessoa` |
| Dia e horário da reunião semanal | Configurações |
| Datas e títulos das entregas das 12 semanas do Avança Café | seed de `semana` |
| Fotos da equipe, do protótipo e da lavoura | páginas Início e Equipe |
| Desenho da colhedora com o ponto de medição | Como funciona |
| Respostas das perguntas frequentes | Como funciona |
| Autorização para usar logos de UFLA, Embrapa Café e Avança Café | rodapé |
| E-mail de contato para privacidade/LGPD | Privacidade |
| Domínio (ex.: `mocca.[PREENCHER].com.br`) | Vercel |
| Previsão de testes de campo | Início, seção Estágio |
