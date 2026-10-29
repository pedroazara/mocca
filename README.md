# MoCCa · site e painel da equipe

Site público do MoCCa (Monitoramento de Colheita de Café, equipe da UFLA) e, nas próximas fases, o painel da equipe. A especificação completa está em [`ESPECIFICACAO.md`](ESPECIFICACAO.md); o que foi decidido de forma diferente e o que falta fazer estão em [`DUVIDAS.md`](DUVIDAS.md).

**Estado atual: fase 1** (base e site público). Painel, login, API e MCP do Claude chegam nas fases 2 e 3.

Stack: Next.js 15 (App Router) + TypeScript, Tailwind CSS 4, Radix, lucide-react, react-hook-form + zod, Supabase, Cloudflare Turnstile, Vitest.

## Rodar localmente

Precisa de Node.js 20 ou mais novo.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra http://localhost:3000. O `.env.example` já traz as chaves de teste do Turnstile, que sempre aprovam. Sem as variáveis do Supabase o site funciona, mas o formulário de contato responde "O envio está fora do ar".

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run build` e `npm start` | Build de produção e servidor |
| `npm test` | Testes (Vitest): schema do contato, migrações e RLS num Postgres embutido |
| `npm run lint` / `npm run typecheck` | ESLint e TypeScript |
| `npm run gerar:curvas` | Regera as curvas de nível do fundo (`components/publico/curvas-dados.ts`) |
| `npm run gerar:produtividade` | Regera o mapa de produtividade ilustrativo do hero (`components/publico/produtividade-dados.ts`) |
| `npm run gerar:icones` | Regera `favicon.ico`, `icon.png` e `apple-icon.png` a partir de `assets/logo/mocca-icone-app.png` |

## Variáveis de ambiente

| Variável | Onde pegar | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › API | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem | Pública. O RLS bloqueia tudo para o usuário anônimo |
| `SUPABASE_SERVICE_ROLE_KEY` | idem | **Só no servidor.** Ignora o RLS |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare › Turnstile | Em desenvolvimento: `1x00000000000000000000AA` |
| `TURNSTILE_SECRET_KEY` | idem | Em desenvolvimento: `1x0000000000000000000000000000000AA` |
| `RESEND_API_KEY` | Resend | Fase 4 |
| `NEXT_PUBLIC_SITE_URL` | | URL pública, sem barra no fim. Usada no sitemap, no robots e nas imagens de compartilhamento |

## Banco de dados (Supabase)

As migrações ficam em `supabase/migrations/` e os dados iniciais em `supabase/seed.sql` (pessoas, etiquetas, as 12 semanas e a configuração; nenhuma tarefa).

Com a [CLI do Supabase](https://supabase.com/docs/guides/cli) (pelo `npx`, sem instalar):

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Depois rode o `supabase/seed.sql` uma vez no SQL Editor do painel do Supabase (ele pode rodar de novo sem duplicar nada).

Antes do seed, troque os e-mails de exemplo (`nome.sobrenome@exemplo.com`) pelos e-mails Google reais. O login (fase 2) só deixa entrar quem está na tabela `pessoa` com `ativo = true`.

Para conferir o RLS: com a chave `anon`, nenhuma tabela pode devolver dados. O teste `testes/banco.test.ts` simula isso localmente; vale repetir no projeto real.

## Deploy (Vercel)

1. Suba o repositório para o GitHub e importe o projeto na Vercel (framework: Next.js, sem configurações extras).
2. Em Settings › Environment Variables, cadastre as variáveis da tabela acima (`SUPABASE_SERVICE_ROLE_KEY` e `TURNSTILE_SECRET_KEY` sem o prefixo `NEXT_PUBLIC_`).
3. No Cloudflare Turnstile, cadastre o domínio da Vercel (e o domínio próprio, quando houver).
4. Cada push na `main` publica o site; cada pull request ganha uma prévia.

## Token da API para o Claude

Chega na fase 3: os tokens serão criados em Configurações do painel (o token aparece uma única vez) e usados como `Authorization: Bearer mocca_...` na API `/api/v1` e no servidor MCP `/api/mcp`. Este README vai trazer o passo a passo de como adicionar o MCP como conector personalizado no Claude.

## Estrutura

```
app/(publico)/        páginas públicas (Início, Como funciona, Equipe, Contato, Privacidade)
app/api/contato/      POST do formulário (zod + Turnstile + Supabase)
components/publico/   componentes do site (cabeçalho, rodapé, mapas, curvas, formulário)
components/ui/        botões, campos, chips, acordeão
lib/                  tokens, validação, Supabase, geração dos mapas, imagem Open Graph
scripts/              geradores de SVG estático e de ícones
supabase/             migrações e seed
testes/               Vitest
```

Regras de texto do site (seção 1.1 da especificação e `DUVIDAS.md`): o MoCCa é um projeto, não uma empresa; não se cita o sensor (nem marca, nem tipo); nada de números inventados; nada de emoji.
