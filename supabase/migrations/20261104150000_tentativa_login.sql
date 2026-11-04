-- Segurança (DUVIDAS 29): o login chama o Supabase de dentro do servidor, e o
-- limite por IP do próprio Supabase só enxerga o IP do servidor. Esta tabela
-- conta as tentativas erradas por e-mail e por IP (em hash) para o painel
-- frear sozinho: 8 erros do mesmo e-mail ou 30 do mesmo IP em 15 minutos.
-- Só o servidor (service role) lê e grava: com o RLS ligado e sem política,
-- ninguém logado nem anônimo vê nada.

create table tentativa_login (
  id         bigserial primary key,
  chave      text not null,          -- 'email:<e-mail>' ou 'ip:<hmac do ip>'
  criado_em  timestamptz not null default now()
);

create index tentativa_login_chave_idx on tentativa_login (chave, criado_em);

alter table tentativa_login enable row level security;
