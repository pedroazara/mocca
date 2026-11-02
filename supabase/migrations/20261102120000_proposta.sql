-- Aprovação do admin (seção 11.4): tudo que o Claude grava com token vira uma
-- proposta, e só entra nas tabelas do painel depois que um admin aprova.
-- As propostas entram pelo service role; quem está logado nunca cria nenhuma.

create type status_proposta as enum ('pendente', 'aprovada', 'recusada', 'falhou');

create table proposta (
  id           uuid primary key default gen_random_uuid(),
  operacao     text not null check (operacao in (
                 'criar_tarefa', 'atualizar_tarefa', 'atribuir', 'remover_atribuicao',
                 'adicionar_item', 'atualizar_item', 'adicionar_documento', 'comentar')),
  dados        jsonb not null,
  tarefa_id    uuid references tarefa(id) on delete set null,   -- null em tarefa nova, até aprovar
  status       status_proposta not null default 'pendente',
  token_id     uuid references token_api(id) on delete set null,
  criado_em    timestamptz not null default now(),
  decidido_em  timestamptz,
  decidido_por uuid references pessoa(id),
  erro         text,                                            -- por que falhou ao aplicar
  resultado    jsonb
);

create index proposta_status_idx on proposta (status, criado_em);

alter table proposta enable row level security;

-- Explícito, sem depender dos privilégios padrão do projeto: toda página do painel
-- lê esta tabela, no contador da barra lateral.
revoke all on proposta from anon, authenticated;
grant select, update on proposta to authenticated;
grant select, insert, update on proposta to service_role;

create policy proposta_ler    on proposta for select to authenticated using (sou_admin());
create policy proposta_editar on proposta for update to authenticated using (sou_admin()) with check (sou_admin());

-- O contador de Aprovações atualiza sozinho, como o quadro (ver 20261029130000_realtime.sql).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.proposta;
  end if;
end $$;
