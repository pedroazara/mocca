# MoCCa · site e painel da equipe

Site público do MoCCa (Monitoramento de Colheita de Café, equipe da UFLA) e painel de tarefas da equipe. A especificação completa está em [`ESPECIFICACAO.md`](ESPECIFICACAO.md); o que foi decidido de forma diferente e o que falta fazer estão em [`DUVIDAS.md`](DUVIDAS.md).

**Estado atual:** as quatro fases estão prontas: site público, painel, API e MCP do Claude, importação do Trello e os confortos da fase 4, inclusive o lembrete por e-mail na véspera do prazo.

Stack: Next.js 15 (App Router) + TypeScript, Tailwind CSS 4, Radix, lucide-react, react-hook-form + zod, dnd-kit, Postgres do Supabase (com RLS), Supabase Auth (e-mail e senha), Cloudflare Turnstile, MCP SDK, Vitest.

## Rodar localmente

Precisa de Node.js 20 ou mais novo.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra http://localhost:3000. Não precisa de Supabase para desenvolver:

- **Sem `DATABASE_URL`, o painel roda em modo local.** Na primeira requisição, um Postgres embutido (PGlite) é criado em `.dados-locais/pg` com as mesmas migrações, o seed, os dados de exemplo (`supabase/seed-dev.sql`, tarefas marcadas `[EXEMPLO]`) e um login por pessoa da equipe. Migrações novas são aplicadas sozinhas na próxima vez que o servidor sobe.
- **Login no modo local:** em `/entrar` aparece a lista da equipe ("Entrar como"). Escolha o Pedro para ver tudo como admin, ou o Prof. Leomar para ver como orientador (só leitura e comentários).
- **Para começar do zero:** pare o servidor, apague a pasta `.dados-locais` e suba de novo.
- O formulário de contato grava no mesmo banco. Com as chaves de teste do Turnstile do `.env.example`, a verificação sempre aprova; sem nenhuma chave, ela fica desligada em desenvolvimento.

O modo local nunca liga num deploy: em produção, sem `DATABASE_URL`, o painel e o formulário respondem que o banco não está configurado.

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run build` e `npm start` | Build de produção e servidor |
| `npm test` | Testes (Vitest): migrações e RLS num Postgres embutido, aprovação das propostas do Claude, schema do contato, datas, pauta, resolução de pessoas da API, importação do Trello e leitura do Drive (com o Google simulado) |
| `npm run lint` / `npm run typecheck` | ESLint e TypeScript |
| `npm run gerar:curvas` | Regera as curvas de nível do fundo (`components/publico/curvas-dados.ts`) |
| `npm run gerar:produtividade` | Regera o mapa de produtividade ilustrativo do hero (`components/publico/produtividade-dados.ts`) |
| `npm run gerar:icones` | Regera `favicon.ico`, `icon.png` e `apple-icon.png` a partir de `assets/logo/mocca-icone-app.png` |

## Variáveis de ambiente

| Variável | Onde pegar | Observação |
|---|---|---|
| `DATABASE_URL` | Supabase › Connect › Transaction pooler (porta 6543) | **Só no servidor.** Sem ela, modo local (só em desenvolvimento) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › API | Login e atualizações ao vivo |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem | Pública. O RLS bloqueia tudo para o usuário anônimo |
| `SUPABASE_SERVICE_ROLE_KEY` | idem | **Secreta, só no servidor.** Cria a conta no primeiro acesso |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare › Turnstile | Em desenvolvimento: `1x00000000000000000000AA` |
| `TURNSTILE_SECRET_KEY` | idem | Em desenvolvimento: `1x0000000000000000000000000000000AA` |
| `GMAIL_APP_PASSWORD` | Conta Google do MoCCa (ver "E-mails automáticos") | **Secreta, só no servidor.** Sem ela, nenhum e-mail sai |
| `GOOGLE_DRIVE_FOLDER` | Drive › pasta do projeto › Compartilhar › Copiar link | Link (ou id) da pasta que a aba Arquivos mostra (ver "Arquivos do Google Drive") |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Google Cloud › Contas de serviço › Chaves | **Secreta, só no servidor.** O JSON inteiro da chave. Sem ela, a aba Arquivos avisa que a pasta não está ligada |
| `CRON_SECRET` | Gere uma sequência aleatória longa (por exemplo, `openssl rand -hex 32`) | **Secreta, só no servidor.** Protege o lembrete da véspera do prazo; a Vercel envia sozinha nas chamadas agendadas. Sem ela, nenhum lembrete sai |
| `NEXT_PUBLIC_SITE_URL` | | URL pública, sem barra no fim. Usada no sitemap, nas imagens de compartilhamento e nos links que a API devolve |

O servidor fala com o Postgres direto (`DATABASE_URL`), e não pela API REST do Supabase. Cada consulta roda numa transação com o papel `authenticated` e o id da pessoa logada (ou com o `service_role`, no formulário e na API do Claude), então o RLS vale do mesmo jeito. A `SUPABASE_SERVICE_ROLE_KEY` só é usada para criar a conta no primeiro acesso.

## Banco de dados (Supabase)

As migrações ficam em `supabase/migrations/` e os dados iniciais em `supabase/seed.sql` (pessoas, etiquetas, as 12 semanas e a configuração; nenhuma tarefa). O `supabase/seed-dev.sql` só entra no banco local.

Com a [CLI do Supabase](https://supabase.com/docs/guides/cli) (pelo `npx`, sem instalar):

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Depois rode o `supabase/seed.sql` uma vez no SQL Editor do Supabase (ele pode rodar de novo sem duplicar nada).

Antes do seed, troque os e-mails de exemplo (`nome.sobrenome@exemplo.com`) pelos e-mails reais. O login só deixa entrar quem está na tabela `pessoa` com `ativo = true`.

Login por e-mail e senha: em `/entrar`, a pessoa digita o e-mail cadastrado. No primeiro acesso, ela cria a senha ali mesmo, sem confirmação por e-mail; depois, entra com ela. **Até criar a senha, a conta pode ser tomada por quem souber o e-mail**, então cada pessoa deve fazer o primeiro acesso logo depois do cadastro, e o admin antes de todos. Em Authentication › Sign In / Providers, desligue "Allow new users to sign up": a conta é criada pelo servidor, e o cadastro direto no Supabase não deve ficar aberto. Mesmo que ele fique aberto por engano, uma conta criada por fora não entra no painel: só o primeiro acesso pela tela `/entrar` liga a conta à pessoa da equipe. Em Project Settings › Data API, tire o esquema `public` dos esquemas expostos: o painel fala com o Postgres direto e não usa essa API (o Realtime não depende dela).

Senhas erradas: depois de 8 tentativas erradas do mesmo e-mail (ou 30 do mesmo IP) em 15 minutos, o login pede para esperar.

Esqueceu a senha: apague o usuário em Authentication › Users. A pessoa continua na equipe, com as tarefas, e cria uma senha nova no próximo acesso.

Para conferir o RLS: com a chave `anon`, nenhuma tabela pode devolver dados. O teste `testes/banco.test.ts` simula isso localmente; vale repetir no projeto real.

## O painel

Em `/painel`, só para quem está na equipe. Admin (Pedro) edita tudo, aprova o que o Claude pede e acessa Configurações; membros editam tarefas e itens; o orientador lê e comenta. O botão "Nova tarefa" (atalho N) fica no topo das páginas.

| Página | O que tem |
|---|---|
| **Semana** (`/painel`) | A semana atual do programa: a entrega do Avança Café e o prazo, as tarefas da semana (uma linha por tarefa, com o anel dos passos feitos; os passos abrem ali mesmo), o que pede atenção (atrasadas, sem responsável, contatos sem resposta) e a próxima reunião. Arrastar uma tarefa abre a barra das 12 semanas para passá-la de semana, com o prazo junto. Setas para ir às outras semanas |
| **Minhas tarefas** | Só o que tem você como responsável ou apoio, separado em atrasadas, esta semana, próximas semanas, anteriores e sem semana |
| **Quadro** | Kanban (A fazer, Fazendo, Em revisão, Feito) com arrastar e soltar, também pelo teclado (espaço para pegar, setas para mover). Filtros por semana, pessoa, etiqueta e atrasadas |
| **Tarefa** | Abre numa janela central (ou em página inteira), em duas colunas: descrição em Markdown, uma atribuição por pessoa com a sua lista de itens, documentos do Drive, comentários e histórico à esquerda; semana, prazo, etiquetas, entrega e origem à direita |
| **Semanas** | As 12 semanas do programa, com entrega, status, link do entregável, anotações e documentos da semana |
| **Equipe** | Um cartão por pessoa com a frente de trabalho e os números (abertas, atrasadas, feitas na semana); a página de cada pessoa lista as tarefas dela. O admin adiciona, edita e desativa pessoas |
| **Reuniões** | Pauta gerada da próxima reunião (entrega da semana, atrasadas, concluídas desde a última, contatos novos), presença, anotações, decisões e tarefas criadas na reunião |
| **Arquivos** | A pasta do projeto no Google Drive: as pastas com o caminho, a busca em todas elas e os arquivos modificados por último. Cada arquivo mostra as tarefas, semanas e atas do painel em que aparece, e abre no Drive |
| **Contatos** | Mensagens do formulário do site, com status, responsável, notas e exportação em CSV. Cada contato novo cria a tarefa "Responder contato" |
| **Aprovações** (admin) | O que o Claude pediu com token e ainda não entrou no painel, com Aprovar e Recusar. Em alterações, mostra o valor de hoje e o proposto. A barra lateral conta as pendentes |
| **Configurações** (admin) | Reunião semanal, responsável pelos contatos, datas do programa, tokens da API, importação do Trello e tema |

**Paleta de comandos:** `Ctrl/Cmd + K` ou `/` busca tarefas, pessoas, semanas, etiquetas e reuniões, e tem as ações rápidas (nova tarefa, nova reunião, alternar tema). Outros atalhos: `N` nova tarefa, `G S` / `G M` / `G Q` para Semana, Minhas tarefas e Quadro, e `?` mostra a lista. Com uma tarefa aberta: `E` edita o título, `A` atribui pessoa e `D` vai para o prazo. No Quadro, com o cartão em foco, `Enter` abre a tarefa e `Espaço` pega e solta.

Mudanças feitas por outras pessoas aparecem sozinhas (Supabase Realtime em produção; a cada 15 s no modo local).

## API e conector do Claude

O Claude lê o painel e pede mudanças com um token criado em **Configurações › Tokens da API do Claude**. O token aparece uma única vez e já começa com `mocca_`: cole inteiro, sem repetir o prefixo. No banco fica só o hash.

### Aprovação do admin

Nada do que chega com token grava direto. Leituras respondem na hora; toda escrita, pela API ou pelo conector, vira uma **proposta pendente** e só entra no painel depois que um admin aprova em **Aprovações** (`/painel/aprovacoes`).

- A resposta do pedido é `{ "status": "pendente", "proposta_id": "...", "tarefa_id": null, "link": "...", "mensagem": "..." }`. Na API REST, o código é `202`.
- O pedido é conferido na hora: pessoa ou etiqueta errada ou repetida, semana ou tarefa errada volta como erro e não cria proposta.
- Ao aprovar, a mudança é aplicada numa transação só e aparece no histórico como "Claude". O e-mail de tarefa atribuída sai nesse momento.
- Se não der para aplicar (a tarefa sumiu, a pessoa saiu da equipe), a proposta fica como `falhou`, com o motivo, e nada é gravado. Um erro inesperado, como uma queda do banco, mantém a proposta pendente, para tentar de novo.
- Não há edição antes de aprovar: se a proposta estiver errada, recuse e peça de novo.
- Tarefa nova não tem id até ser aprovada, então atribuições, itens e documentos vão dentro do próprio `criar_tarefa`.

O Claude acompanha os pedidos com `listar_propostas` (MCP) ou `GET /api/v1/propostas` (REST).

### Conector MCP

Endereço: `https://SEU_DOMINIO/api/mcp` (stateless, Streamable HTTP, só `POST`; `GET` e `DELETE` respondem `405`). Ferramentas: `listar_pessoas`, `listar_semanas`, `listar_tarefas`, `ver_tarefa`, `criar_tarefa`, `atualizar_tarefa`, `atribuir`, `marcar_item`, `adicionar_documento`, `comentar`, `listar_propostas` e `pauta_proxima_reuniao`. As que escrevem só criam propostas.

**No Claude Code:**

```bash
claude mcp add --transport http mocca https://SEU_DOMINIO/api/mcp --header "Authorization: Bearer COLE_O_TOKEN_AQUI"
```

**No Claude (app e site):** em Configurações › Conectores › Adicionar conector personalizado:

1. Em URL, cole `https://SEU_DOMINIO/api/mcp`, sem o token no endereço.
2. Em Autenticação, escolha **Sem login**. O painel não tem OAuth: as outras opções tentam abrir um login que não existe.
3. Em Cabeçalhos de requisição (recurso em beta), adicione o nome `authorization` com o valor `Bearer COLE_O_TOKEN_AQUI`. O valor é enviado exatamente como foi digitado: precisa começar com `Bearer ` e ter o token inteiro, uma vez só.

O valor salvo não aparece de novo e não pode ser editado: para trocar o token, remova o conector e adicione de novo. Se o token vazar, revogue em Configurações e crie outro. Mais detalhes na [documentação de conectores do Claude](https://claude.com/docs/connectors/custom/add-unlisted.md).

Exemplo de pedido: "Crie a tarefa 'Entrevistas de disposição a pagar' na semana 2, responsável Gabriel com os itens agendar 3 produtores e conduzir as entrevistas, apoio Marcos para preencher a planilha, prazo sexta."

### REST (`/api/v1`)

Todas as rotas pedem `Authorization: Bearer` e o token, e respondem JSON. Pessoas podem ser indicadas por id, e-mail, apelido ou nome, sem diferenciar maiúsculas e acentos; nome ambíguo ou inexistente volta com erro 422 e a lista de pessoas válidas. Toda escrita responde `202` com a proposta pendente e o `link` dela no painel. Limite: 120 requisições por minuto por token.

| Método e rota | O que faz |
|---|---|
| `GET /api/v1/pessoas` | Equipe |
| `GET /api/v1/semanas?atual=true` | Semanas do programa (ou só a atual) |
| `GET /api/v1/tarefas?semana=&pessoa=&status=&etiqueta=&atrasadas=` | Lista tarefas |
| `POST /api/v1/tarefas` | Propõe tarefa com atribuições, itens e documentos |
| `GET` / `PATCH /api/v1/tarefas/{id}` | Vê, ou propõe alterar (título, descrição, status, prazo, semana, etiquetas) |
| `POST /api/v1/tarefas/{id}/atribuicoes` | Propõe atribuir uma pessoa (com itens) |
| `DELETE /api/v1/tarefas/{id}/atribuicoes/{pessoa}` | Propõe remover a atribuição |
| `POST /api/v1/tarefas/{id}/itens` | Propõe adicionar item de uma pessoa, que entra na tarefa se ainda não estiver nela |
| `PATCH /api/v1/itens/{id}` | Propõe marcar, desmarcar ou renomear um item |
| `POST /api/v1/tarefas/{id}/documentos` | Propõe anexar link do Google Drive ou Docs |
| `POST /api/v1/tarefas/{id}/comentarios` | Propõe comentar como "Claude" |
| `GET /api/v1/propostas?status=` | Lista as propostas e a situação de cada uma |
| `GET /api/v1/reunioes/proxima` | Pauta da próxima reunião |

Exemplo:

```bash
curl -X POST https://SEU_DOMINIO/api/v1/tarefas \
  -H "Authorization: Bearer COLE_O_TOKEN_AQUI" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @tarefa.json
```

com o `tarefa.json`:

```json
{
  "titulo": "Entrevistas de disposição a pagar",
  "semana": 2,
  "prazo": "2026-10-31T21:00:00-03:00",
  "etiquetas": ["Validação do Produto"],
  "origem": "reuniao",
  "atribuicoes": [
    { "pessoa": "Gabriel", "papel": "responsavel", "itens": ["Agendar 3 produtores", "Conduzir entrevistas"] },
    { "pessoa": "marcos", "papel": "apoio", "itens": ["Preencher a planilha de registro"] }
  ],
  "documentos": [{ "titulo": "Roteiro", "url": "https://docs.google.com/document/d/...", "tipo": "roteiro" }]
}
```

## Importar do Trello

Em Configurações › Importar do Trello, envie o JSON exportado do quadro (menu do quadro › Imprimir, exportar e compartilhar › Exportar como JSON). A tela mostra a prévia antes de gravar. Listas "Semana N" viram tarefas da semana; "Em andamento" e "Finalizados" viram tarefas nesse status; checklists com o nome de uma pessoa viram a atribuição dela, com os itens; links do Drive viram documentos; a lista "Links" vai para os documentos da semana 1. Reimportar não duplica.

## E-mails automáticos

Os e-mails saem de `moccaufla@gmail.com`, pelo SMTP do Gmail. O Resend da especificação não serve aqui porque só envia de um domínio próprio verificado.

- **Tarefa atribuída:** quem recebe uma tarefa ganha um e-mail com título, papel, prazo, itens e link, venha a atribuição do painel, do formulário do site ou de uma proposta do Claude, que só avisa quando o admin aprova. Quem atribui a si mesmo não recebe. Trocar o papel, duplicar uma tarefa e importar do Trello não enviam nada.
- **Contato pelo site:** quem preenche o formulário recebe uma confirmação de texto fixo, sem repetir a mensagem, porque qualquer um pode digitar o endereço de outra pessoa. O limite de 5 envios por hora e o Turnstile valem aqui também, e o mesmo endereço recebe no máximo uma confirmação por dia.
- **Véspera do prazo:** todo dia às 8h de Brasília, a Vercel chama `/api/cron/lembretes` (agendado no `vercel.json`), e cada pessoa recebe um e-mail só com as tarefas abertas dela que vencem no dia seguinte, com os itens dela ainda não feitos. Tarefa feita ou arquivada não entra. Precisa da variável `CRON_SECRET` na Vercel; para testar à mão: `curl -H "Authorization: Bearer $CRON_SECRET" https://SEU_DOMINIO/api/cron/lembretes`. A resposta diz quantas tarefas vencem amanhã, quantos e-mails foram montados (`emails`, um por pessoa) e quantos o Gmail aceitou (`enviados`): sem `GMAIL_APP_PASSWORD`, para os endereços de exemplo ou com falha no envio, não conta.

Para ligar:

1. Entre em `moccaufla@gmail.com` e ative a verificação em duas etapas (<https://myaccount.google.com/security>).
2. Crie uma senha de app em <https://myaccount.google.com/apppasswords>.
3. Coloque as 16 letras em `GMAIL_APP_PASSWORD`, no `.env.local` e nas variáveis da Vercel.

Em produção, os links dos e-mails usam `NEXT_PUBLIC_SITE_URL`, e a equipe precisa estar com os e-mails reais: nada é enviado para endereços `@exemplo.com`, os do seed. O limite do Gmail é de cerca de 500 envios por dia.

## Arquivos do Google Drive

A aba **Arquivos** (`/painel/arquivos`) mostra a pasta do projeto no Drive. O servidor lê a pasta com uma conta de serviço do Google, que só enxerga o que foi compartilhado com ela e só lê os metadados (nome, tipo, data, quem mexeu e link), nunca o conteúdo. Os arquivos abrem no próprio Drive, com a conta Google de quem clicou: quem ainda não tem acesso à pasta pede por lá.

Para ligar (uma vez só):

1. Em <https://console.cloud.google.com>, entre com uma conta pessoal, como a `moccaufla@gmail.com`, e crie um projeto. Projetos de uma organização, como a da UFLA, costumam bloquear a criação de chaves.
2. Em APIs e serviços › Biblioteca, ative a **Google Drive API**.
3. Em IAM e administrador › Contas de serviço, crie uma conta de serviço, sem dar papel nenhum no projeto. Na conta criada, em Chaves › Adicionar chave › Criar nova chave, escolha JSON. O arquivo que baixar é a chave: guarde como uma senha.
4. No Drive, compartilhe a pasta do projeto com o e-mail da conta de serviço (`...@....iam.gserviceaccount.com`), como **Leitor**.
5. Cadastre no `.env.local` e nas variáveis da Vercel `GOOGLE_DRIVE_FOLDER`, com o link da pasta (`https://drive.google.com/drive/folders/...`), e `GOOGLE_SERVICE_ACCOUNT_KEY`, com o conteúdo inteiro do JSON. Na Vercel, o JSON pode ser colado como está; num lugar que só aceite uma linha, use o JSON em base64 (`base64 -w0 chave.json`).
6. Publique de novo. A aba mostra a pasta, ou o motivo de não conseguir; o admin vê também o e-mail da conta de serviço e a resposta do Google.

Como funciona:

- A pasta inteira vem numa consulta por nível de pastas e fica 1 minuto na memória do servidor. O Atualizar, embaixo da lista, lê de novo na hora. Navegar entre pastas, buscar e ver os recentes não volta ao servidor, e a pasta aberta fica na URL (`?pasta=`), para mandar o link.
- Cada arquivo mostra onde aparece no painel (documentos das tarefas e das semanas, links de entregável e atas de reunião), pelo id do link do Drive.
- Quem mexeu por último aparece com o nome que tem na equipe quando o e-mail do Google é o mesmo do painel. O e-mail não sai do servidor.
- Atalhos do Drive abrem o destino no Drive, sem entrar nele pelo painel. Uma pasta com mais de 5.000 itens é lida só em parte, com aviso.
- No modo local, sem as duas variáveis, a aba mostra uma pasta de exemplo, com os documentos dos dados de exemplo.
- Trocar de pasta é trocar `GOOGLE_DRIVE_FOLDER` e publicar de novo. Para desligar, tire o compartilhamento da conta de serviço no Drive ou apague a chave no Google Cloud.

## Deploy (Vercel)

1. Suba o repositório para o GitHub e importe o projeto na Vercel (framework: Next.js, sem configurações extras).
2. Em Settings › Environment Variables, cadastre as variáveis da tabela acima (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `GMAIL_APP_PASSWORD` e `GOOGLE_SERVICE_ACCOUNT_KEY` sem o prefixo `NEXT_PUBLIC_`).
3. No Cloudflare Turnstile, cadastre o domínio da Vercel (e o domínio próprio, quando houver).
4. Cada push na `main` publica o site; cada pull request ganha uma prévia.

Aplique as migrações novas no Supabase (`npx supabase db push`) **antes** de publicar o código que depende delas. A barra lateral consulta `proposta` em toda página do painel: sem a migração `20261102120000_proposta.sql`, o painel inteiro e as escritas do Claude dão erro 500. A migração só acrescenta, então o código antigo continua funcionando com ela.

**Exceção, as migrações de 2026-11-04** (`20261104120000` a `20261104150000`): aqui a ordem é a inversa. Publique o código primeiro e só depois rode o `npx supabase db push`. O código novo funciona com ou sem elas, mas a `20261104130000_ligacao_da_conta.sql` tira do banco a ligação automática da conta de que o código antigo dependia: com ela aplicada e o código antigo no ar, o primeiro acesso cria uma conta solta e a pessoa cai em "Acesso negado". Pelo mesmo motivo, depois de aplicá-las, não volte a Vercel para uma publicação anterior a elas.

## Estrutura

```
app/(publico)/        páginas públicas (Início, Como funciona, Equipe, Contato, Privacidade)
app/painel/           painel da equipe (páginas, ações do servidor e a janela da tarefa)
app/entrar/           login (e-mail e senha em produção; "entrar como" no modo local)
app/api/contato/      POST do formulário (zod + Turnstile + registrar_contato)
app/api/fotos/        fotos públicas da equipe, guardadas no Postgres
app/api/v1/           API REST do Claude
app/api/mcp/          servidor MCP do Claude
components/publico/   componentes do site
components/painel/    componentes do painel
components/ui/        botões, campos, chips, acordeão
lib/banco/            acesso ao Postgres (remoto ou PGlite), sempre com RLS
lib/painel/           consultas, tipos, datas, pauta e importação do Trello
lib/api/              regras da API (tokens, validação, resolução de pessoas)
lib/drive/            leitura da pasta do Google Drive (conta de serviço) e regras da aba Arquivos
scripts/              geradores de SVG estático e de ícones
supabase/             migrações, seed, dados de exemplo e a simulação do Supabase para o modo local
testes/               Vitest
```

Regras de texto do site (seção 1.1 da especificação e `DUVIDAS.md`): o MoCCa é um projeto, não uma empresa; não se cita o sensor (nem marca, nem tipo); nada de números inventados; nada de emoji.
