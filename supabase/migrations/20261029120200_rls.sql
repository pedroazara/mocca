-- Regras de acesso (seção 10.3). RLS ligado em todas as tabelas; o usuário anônimo
-- não lê nem escreve nada. O service role ignora RLS e só é usado no servidor.
--
-- As funções auxiliares são security definer: elas consultam `pessoa`, que também
-- tem RLS chamando estas funções. Sem security definer, a política de `pessoa`
-- entraria em recursão infinita (ver DUVIDAS.md).

create function eu() returns pessoa
language sql stable security definer set search_path = public as $$
  select * from pessoa where auth_id = auth.uid() and ativo
$$;

create function sou_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pessoa where auth_id = auth.uid() and ativo)
$$;

create function posso_editar() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pessoa where auth_id = auth.uid() and ativo and papel in ('admin', 'membro'))
$$;

create function sou_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pessoa where auth_id = auth.uid() and ativo and papel = 'admin')
$$;

alter table pessoa           enable row level security;
alter table semana           enable row level security;
alter table etiqueta         enable row level security;
alter table reuniao          enable row level security;
alter table contato          enable row level security;
alter table tarefa           enable row level security;
alter table tarefa_etiqueta  enable row level security;
alter table atribuicao       enable row level security;
alter table item             enable row level security;
alter table documento        enable row level security;
alter table reuniao_presenca enable row level security;
alter table decisao          enable row level security;
alter table comentario       enable row level security;
alter table historico        enable row level security;
alter table configuracao     enable row level security;
alter table token_api        enable row level security;

-- Trabalho do dia a dia: membros leem; admin e membro criam, editam e apagam.
do $$
declare
  t text;
begin
  foreach t in array array['tarefa', 'atribuicao', 'item', 'documento', 'tarefa_etiqueta',
                           'reuniao', 'decisao', 'reuniao_presenca']
  loop
    execute format('create policy %1$s_ler on %1$I for select to authenticated using (sou_membro())', t);
    execute format('create policy %1$s_criar on %1$I for insert to authenticated with check (posso_editar())', t);
    execute format('create policy %1$s_editar on %1$I for update to authenticated using (posso_editar()) with check (posso_editar())', t);
    execute format('create policy %1$s_apagar on %1$I for delete to authenticated using (posso_editar())', t);
  end loop;
end $$;

-- Semanas: todos leem, só o admin edita.
create policy semana_ler    on semana for select to authenticated using (sou_membro());
create policy semana_criar  on semana for insert to authenticated with check (sou_admin());
create policy semana_editar on semana for update to authenticated using (sou_admin()) with check (sou_admin());
create policy semana_apagar on semana for delete to authenticated using (sou_admin());

-- Comentários: qualquer membro (inclusive orientador) comenta; edita só o próprio.
create policy comentario_ler on comentario for select to authenticated using (sou_membro());
create policy comentario_criar on comentario for insert to authenticated
  with check (sou_membro() and autor_id = (eu()).id);
create policy comentario_editar on comentario for update to authenticated
  using (autor_id = (eu()).id) with check (autor_id = (eu()).id);
create policy comentario_apagar on comentario for delete to authenticated
  using (autor_id = (eu()).id or sou_admin());

-- Histórico: só leitura; quem escreve são os gatilhos.
create policy historico_ler on historico for select to authenticated using (sou_membro());

-- Contatos: entram só pelo service role (rota /api/contato).
create policy contato_ler    on contato for select to authenticated using (sou_membro());
create policy contato_editar on contato for update to authenticated using (posso_editar()) with check (posso_editar());
create policy contato_apagar on contato for delete to authenticated using (sou_admin());

-- Pessoas, etiquetas e configuração: todos leem, só o admin altera, ninguém apaga.
create policy pessoa_ler    on pessoa for select to authenticated using (sou_membro());
create policy pessoa_criar  on pessoa for insert to authenticated with check (sou_admin());
create policy pessoa_editar on pessoa for update to authenticated using (sou_admin()) with check (sou_admin());

create policy etiqueta_ler    on etiqueta for select to authenticated using (sou_membro());
create policy etiqueta_criar  on etiqueta for insert to authenticated with check (sou_admin());
create policy etiqueta_editar on etiqueta for update to authenticated using (sou_admin()) with check (sou_admin());

create policy configuracao_ler    on configuracao for select to authenticated using (sou_membro());
create policy configuracao_criar  on configuracao for insert to authenticated with check (sou_admin());
create policy configuracao_editar on configuracao for update to authenticated using (sou_admin()) with check (sou_admin());

-- Tokens de API: só o admin vê e cria; revogar é um update.
create policy token_api_ler    on token_api for select to authenticated using (sou_admin());
create policy token_api_criar  on token_api for insert to authenticated with check (sou_admin());
create policy token_api_editar on token_api for update to authenticated using (sou_admin()) with check (sou_admin());

-- Defesa extra: o papel anônimo não tem nenhum privilégio nas tabelas.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
