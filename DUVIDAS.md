# Dúvidas, decisões e pendências

Registro do que foi feito de forma diferente da `ESPECIFICACAO.md`, e por quê (instrução 4 da seção 0), mais a lista de pendências.

## Decisões pedidas pelo Pedro (sobrepõem a especificação)

1. **Nada de "sensor" no site.** A seção 1.1 permitia "sensor de profundidade". O Pedro pediu para não citar o sensor de forma nenhuma: o site fala em "uma tecnologia instalada na colhedora" ou "o equipamento". Vale para Início, Como funciona, metadados e imagens de compartilhamento.
2. **Ponto de medição no tubo de saída.** O equipamento fica no alto da colhedora, no tubo de saída por onde passa todo o café antes de cair no depósito. O esquema de `/como-funciona` e o texto da seção "Onde o equipamento fica" seguem isso.
3. **Hero com mapa de produtividade, parado.** A seção 4.7 pedia uma grade de retângulos irregulares no hero, e a 4.9, uma animação de entrada dos talhões. A pedido do Pedro, o hero mostra um mapa de produtividade ilustrativo: uma lavoura com manchas de produção nas 5 faixas da legenda, divisas finas como curvas de nível e um pin na mancha mais forte ("cada saca tem um endereço"). Sem animação. Foram descartados, nesta ordem: a grade de retângulos, uma fazenda em curvas de nível com talhões e carreadores (com e sem animação da colhedora). **O site deve ser simples e informativo**, porque é usado para apresentar o MoCCa ao agro. A grade de retângulos continua na seção "O que você passa a ver" e na comparação da seção "O problema".

4a. **Vinheta "Mede" animada (pedido do Pedro).** Na página inicial, a vinheta do passo "Mede" mostra frutos de café (cereja, verde, amarelo e passa) andando na esteira e passando sob um laser; o café que já passou sai com o perfil medido desenhado por cima. É só CSS e fica parada com movimento reduzido. O texto do site continua sem citar o sensor.

## Decisões técnicas

4. **Funções de RLS como `security definer`.** A seção 10.3 define `sou_membro()`, `posso_editar()` e `sou_admin()` como funções SQL comuns. Como elas consultam `pessoa`, e a política de `pessoa` chama essas funções, o Postgres entraria em recursão infinita. Ficaram `security definer` com `search_path` fixo.
5. **Ordem das tabelas.** `reuniao` e `contato` são criadas antes de `tarefa` (a própria especificação avisa).
6. **Histórico.** Além das ações da seção 10.2, o gatilho grava `criou` (na criação da tarefa) e `item_reaberto` (quando um item volta a ficar aberto). `via_api` é verdadeiro quando quem grava é o service role, exceto no formulário do site, que marca a transação como origem `site`.
7. **Contato do site numa transação só.** A rota `/api/contato` chama a função `registrar_contato`, que faz o limite de 5 envios por IP por hora, grava o contato, cria a tarefa "Responder contato: {nome}" na semana atual (prazo: fim da semana, 23:59 de Brasília) e atribui ao responsável configurado.
8. **IP do contato.** Nunca é guardado. A coluna `ip_hash` recebe um HMAC-SHA256 do IP, com a `TURNSTILE_SECRET_KEY` como chave, para não criar mais uma variável de ambiente.
9. **Cores derivadas.** Foram acrescentados tokens que não estavam na seção 4.4: `--rodape-fundo` (espresso no claro, `#120C08` no escuro, como pede a 6.2) e `--talhao-1` a `--talhao-5`, os 5 tons do mapa, misturados por `color-mix` a partir das cores da marca. No tema escuro a escala se inverte (baixa = escuro, alta = claro) para continuar legível. Também há `--fruto-cereja`, `--fruto-verde`, `--fruto-amarelo` e `--fruto-passa`, as cores dos frutos de café na vinheta "Mede", iguais nos dois temas porque são cores físicas do café.
10. **Build de produção com webpack.** O build com Turbopack (beta no Next 15) colocava o código do formulário e do Turnstile no carregamento da página inicial. Com webpack, a página inicial carrega 113 kB de JS em vez de 164 kB.
11. **Curvas de nível do fundo.** São geradas uma vez por `scripts/gerar-curvas.mjs` e ficam numa única definição SVG por página, reaproveitada com `<use>`. O fundo usa só as linhas que atravessam o quadro.
12. **Conteúdo a mais na página inicial.** A seção "O problema" ganhou uma comparação ilustrativa ("O que a planilha mostra" × "O que a lavoura tem"), e a seção "Para quem" ganhou o título "Quem ganha com o mapa." (a especificação não dava título).
13. **CSS no HTML.** `experimental.inlineCss` (Next 15) coloca o CSS dentro do HTML, sem requisição bloqueante antes da primeira pintura.
14. **Lighthouse da página inicial (medido localmente, `next start`, Lighthouse 12).** Desktop: 100 nas quatro categorias. Celular: acessibilidade, boas práticas e SEO em 100; desempenho entre 94 e 95, um pouco abaixo da meta de 95 da seção 6.8. O que pesa é o JS base do React/Next e as três fontes, que a simulação de 4G conta antes do maior elemento pintar. Conferir de novo depois do deploy na Vercel (CDN e compressão brotli costumam ajudar). Se ainda faltar, as próximas alavancas são tirar uma das fontes da primeira dobra ou adiar os outros SVGs da página.

## Pendências

- [ ] **Redesenhar o esquema da colhedora** de `/como-funciona` como um desenho técnico de verdade (pedido do Pedro). O atual é um esquema simples, já com o ponto de medição no tubo de saída.
- [ ] Criar o projeto no Supabase, aplicar as migrações e o seed, e preencher `.env.local` e as variáveis na Vercel (ver README).
- [ ] Gerar as chaves reais do Cloudflare Turnstile para o domínio.
- [ ] Conferir no Supabase real o envio do formulário (aceite da fase 1: "contato enviado aparece na tabela `contato`"). Localmente foi testado com um Postgres embutido (PGlite).
- [ ] Deploy na Vercel (aceite da fase 1).
- [ ] A página `/entrar` é da fase 2; até lá, o link "Área da equipe" do rodapé leva à página 404.
- [ ] Itens `[PREENCHER]` da seção 16: e-mails Google da equipe, dia e horário da reunião, datas e títulos das entregas, fotos, desenho da colhedora, respostas do FAQ, autorização de logos, e-mail de privacidade, domínio, previsão dos testes de campo. Todos estão marcados no código com `TODO(pedro)`.
- [ ] Fases 2, 3 e 4 (painel, reuniões, contatos, API e MCP do Claude, importação do Trello, e-mails).
