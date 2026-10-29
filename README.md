# MoCCa · site e painel da equipe

Site público do MoCCa (Monitoramento de Colheita de Café, equipe da UFLA) e painel de tarefas da equipe. A especificação completa está em [`ESPECIFICACAO.md`](ESPECIFICACAO.md); o que foi decidido de forma diferente e o que falta fazer estão em [`DUVIDAS.md`](DUVIDAS.md).

**Estado atual:** fase 1 (site público), fase 2 (painel), fase 3 (API e MCP do Claude) e a importação do Trello prontas. Da fase 4 faltam os e-mails (Resend) e a paleta de comandos.

Stack: Next.js 15 (App Router) + TypeScript, Tailwind CSS 4, Radix, lucide-react, react-hook-form + zod, dnd-kit, Postgres do Supabase (com RLS), Supabase Auth (Google), Cloudflare Turnstile, MCP SDK, Vitest.

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
| `npm test` | Testes (Vitest): migrações e RLS num Postgres embutido, schema do contato, datas, pauta, resolução de pessoas da API e importação do Trello |
| `npm run lint` / `npm run typecheck` | ESLint e TypeScript |
| `npm run gerar:curvas` | Regera as curvas de nível do fundo (`components/publico/curvas-dados.ts`) |
| `npm run gerar:produtividade` | Regera o mapa de produtividade ilustrativo do hero (`components/publico/produtividade-dados.ts`) |
| `npm run gerar:icones` | Regera `favicon.ico`, `icon.png` e `apple-icon.png` a partir de `assets/logo/mocca-icone-app.png` |

## Variáveis de ambiente

| Variável | Onde pegar | Observação |
|---|---|---|
| `DATABASE_URL` | Supabase › Connect › Transaction pooler (porta 6543) | **Só no servidor.** Sem ela, modo local (só em desenvolvimento) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › API | Login Google e atualizações ao vivo |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem | Pública. O RLS bloqueia tudo para o usuário anônimo |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare › Turnstile | Em desenvolvimento: `1x00000000000000000000AA` |
| `TURNSTILE_SECRET_KEY` | idem | Em desenvolvimento: `1x0000000000000000000000000000000AA` |
| `RESEND_API_KEY` | Resend | Fase 4 (ainda não usada) |
| `NEXT_PUBLIC_SITE_URL` | | URL pública, sem barra no fim. Usada no sitemap, nas imagens de compartilhamento e nos links que a API devolve |

O servidor fala com o Postgres direto (`DATABASE_URL`), e não pela API REST do Supabase. Cada consulta roda numa transação com o papel `authenticated` e o id da pessoa logada (ou com o `service_role`, no formulário e na API do Claude), então o RLS vale do mesmo jeito. Por isso não é preciso a `SUPABASE_SERVICE_ROLE_KEY`.

## Banco de dados (Supabase)

As migrações ficam em `supabase/migrations/` e os dados iniciais em `supabase/seed.sql` (pessoas, etiquetas, as 12 semanas e a configuração; nenhuma tarefa). O `supabase/seed-dev.sql` só entra no banco local.

Com a [CLI do Supabase](https://supabase.com/docs/guides/cli) (pelo `npx`, sem instalar):

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Depois rode o `supabase/seed.sql` uma vez no SQL Editor do Supabase (ele pode rodar de novo sem duplicar nada).

Antes do seed, troque os e-mails de exemplo (`nome.sobrenome@exemplo.com`) pelos e-mails Google reais. O login só deixa entrar quem está na tabela `pessoa` com `ativo = true`; o primeiro login liga a conta Google à pessoa pelo e-mail.

Login com Google: em Authentication › Providers, ative o Google com o client ID e o secret do Google Cloud; em Authentication › URL Configuration, cadastre `https://SEU_DOMINIO/auth/callback` (e `http://localhost:3000/auth/callback` se for testar o login real localmente).

Para conferir o RLS: com a chave `anon`, nenhuma tabela pode devolver dados. O teste `testes/banco.test.ts` simula isso localmente; vale repetir no projeto real.

## O painel

Em `/painel`, só para quem está na equipe. Admin (Pedro) edita tudo e acessa Configurações; membros editam tarefas e itens; o orientador lê e comenta. O botão "Nova tarefa" (atalho N) fica no topo das páginas.

| Página | O que tem |
|---|---|
| **Semana** (`/painel`) | A semana atual do programa: a entrega do Avança Café e o prazo, as tarefas por pessoa, o que pede atenção (atrasadas, sem responsável, contatos sem resposta) e a próxima reunião. Setas para ir às outras semanas |
| **Minhas tarefas** | Só o que tem você como responsável ou apoio, separado em atrasadas, esta semana, próximas semanas, anteriores e sem semana |
| **Quadro** | Kanban (A fazer, Fazendo, Em revisão, Feito) com arrastar e soltar, também pelo teclado (espaço para pegar, setas para mover). Filtros por semana, pessoa, etiqueta e atrasadas |
| **Tarefa** | Abre num painel lateral (ou em página inteira): status, prazo, semana, etiquetas, descrição em Markdown, uma atribuição por pessoa com a sua lista de itens, documentos do Drive, comentários e histórico |
| **Semanas** | As 12 semanas do programa, com entrega, status, link do entregável, anotações e documentos da semana |
| **Equipe** | Um cartão por pessoa com a frente de trabalho e os números (abertas, atrasadas, feitas na semana); a página de cada pessoa lista as tarefas dela. O admin adiciona, edita e desativa pessoas |
| **Reuniões** | Pauta gerada da próxima reunião (entrega da semana, atrasadas, concluídas desde a última, contatos novos), presença, anotações, decisões e tarefas criadas na reunião |
| **Contatos** | Mensagens do formulário do site, com status, responsável, notas e exportação em CSV. Cada contato novo cria a tarefa "Responder contato" |
| **Configurações** (admin) | Reunião semanal, responsável pelos contatos, datas do programa, tokens da API, importação do Trello e tema |

Mudanças feitas por outras pessoas aparecem sozinhas (Supabase Realtime em produção; a cada 15 s no modo local).

## API e conector do Claude

O Claude cria e atribui tarefas pelo mesmo banco, com um token criado em **Configurações › Tokens da API do Claude**. O token (`mocca_...`) aparece uma única vez; no banco fica só o hash. Tudo o que entra pela API aparece no histórico como "Claude".

### Conector MCP

Endereço: `https://SEU_DOMINIO/api/mcp` (stateless, Streamable HTTP). Ferramentas: `listar_pessoas`, `listar_semanas`, `listar_tarefas`, `ver_tarefa`, `criar_tarefa`, `atualizar_tarefa`, `atribuir`, `marcar_item`, `adicionar_documento`, `comentar` e `pauta_proxima_reuniao`.

**No Claude Code:**

```bash
claude mcp add --transport http mocca https://SEU_DOMINIO/api/mcp --header "Authorization: Bearer mocca_SEU_TOKEN"
```

**No Claude (app e site):** em Configurações › Conectores › Adicionar conector personalizado, cole a URL com o token no fim, porque essa tela não deixa mandar cabeçalho:

```
https://SEU_DOMINIO/api/mcp?token=mocca_SEU_TOKEN
```

Trate essa URL como uma senha. Se ela vazar, revogue o token em Configurações e crie outro.

Exemplo de pedido: "Crie a tarefa 'Entrevistas de disposição a pagar' na semana 2, responsável Gabriel com os itens agendar 3 produtores e conduzir as entrevistas, apoio Marcos para preencher a planilha, prazo sexta."

### REST (`/api/v1`)

Todas as rotas pedem `Authorization: Bearer mocca_...` e respondem JSON. Pessoas podem ser indicadas por id, e-mail, apelido ou nome, sem diferenciar maiúsculas e acentos; nome ambíguo ou inexistente volta com erro 422 e a lista de pessoas válidas. Toda escrita devolve o `link` da tarefa no painel. Limite: 120 requisições por minuto por token.

| Método e rota | O que faz |
|---|---|
| `GET /api/v1/pessoas` | Equipe |
| `GET /api/v1/semanas?atual=true` | Semanas do programa (ou só a atual) |
| `GET /api/v1/tarefas?semana=&pessoa=&status=&etiqueta=&atrasadas=` | Lista tarefas |
| `POST /api/v1/tarefas` | Cria tarefa com atribuições, itens e documentos, numa transação só |
| `GET` / `PATCH /api/v1/tarefas/{id}` | Vê ou altera (título, descrição, status, prazo, semana, etiquetas) |
| `POST /api/v1/tarefas/{id}/atribuicoes` | Atribui uma pessoa (com itens) |
| `DELETE /api/v1/tarefas/{id}/atribuicoes/{pessoa}` | Remove a atribuição |
| `POST /api/v1/tarefas/{id}/itens` | Adiciona item a uma atribuição |
| `PATCH /api/v1/itens/{id}` | Marca, desmarca ou renomeia um item |
| `POST /api/v1/tarefas/{id}/documentos` | Anexa link do Google Drive ou Docs |
| `POST /api/v1/tarefas/{id}/comentarios` | Comenta como "Claude" |
| `GET /api/v1/reunioes/proxima` | Pauta da próxima reunião |

Exemplo:

```bash
curl -X POST https://SEU_DOMINIO/api/v1/tarefas \
  -H "Authorization: Bearer mocca_SEU_TOKEN" \
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

## Deploy (Vercel)

1. Suba o repositório para o GitHub e importe o projeto na Vercel (framework: Next.js, sem configurações extras).
2. Em Settings › Environment Variables, cadastre as variáveis da tabela acima (`DATABASE_URL` e `TURNSTILE_SECRET_KEY` sem o prefixo `NEXT_PUBLIC_`).
3. No Cloudflare Turnstile, cadastre o domínio da Vercel (e o domínio próprio, quando houver).
4. No Supabase, cadastre a URL de callback do login (ver acima).
5. Cada push na `main` publica o site; cada pull request ganha uma prévia.

## Estrutura

```
app/(publico)/        páginas públicas (Início, Como funciona, Equipe, Contato, Privacidade)
app/painel/           painel da equipe (páginas, ações do servidor e o painel lateral da tarefa)
app/entrar/           login (Google em produção; "entrar como" no modo local)
app/api/contato/      POST do formulário (zod + Turnstile + registrar_contato)
app/api/v1/           API REST do Claude
app/api/mcp/          servidor MCP do Claude
components/publico/   componentes do site
components/painel/    componentes do painel
components/ui/        botões, campos, chips, acordeão
lib/banco/            acesso ao Postgres (remoto ou PGlite), sempre com RLS
lib/painel/           consultas, tipos, datas, pauta e importação do Trello
lib/api/              regras da API (tokens, validação, resolução de pessoas)
scripts/              geradores de SVG estático e de ícones
supabase/             migrações, seed, dados de exemplo e a simulação do Supabase para o modo local
testes/               Vitest
```

Regras de texto do site (seção 1.1 da especificação e `DUVIDAS.md`): o MoCCa é um projeto, não uma empresa; não se cita o sensor (nem marca, nem tipo); nada de números inventados; nada de emoji.
