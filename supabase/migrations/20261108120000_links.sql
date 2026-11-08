-- Links da equipe (página Links do painel, pedido do Pedro): pastas do Drive,
-- portal do Avança Café, formulários, referências. Diferente de `documento`,
-- aceita qualquer endereço http(s) e não fica preso a uma tarefa ou semana.

create table link (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (char_length(titulo) between 1 and 200),
  url         text not null check (url ~ '^https?://[^[:space:]]+$' and char_length(url) <= 2000),
  descricao   text check (char_length(descricao) <= 500),
  categoria   text check (char_length(categoria) between 1 and 60),
  criado_por  uuid references pessoa(id) on delete set null,
  criado_em   timestamptz not null default now()
);

create index link_categoria_idx on link (categoria, titulo);

-- Mesmas regras do trabalho do dia a dia: membros leem; admin e membro criam,
-- editam e apagam; o orientador só lê.
alter table link enable row level security;
create policy link_ler    on link for select to authenticated using (sou_membro());
create policy link_criar  on link for insert to authenticated with check (posso_editar());
create policy link_editar on link for update to authenticated using (posso_editar()) with check (posso_editar());
create policy link_apagar on link for delete to authenticated using (posso_editar());

revoke all on link from anon;
