-- Supabase Realtime nas tabelas do quadro (seção 13.3), para duas pessoas verem
-- as mudanças uma da outra sem recarregar. Só existe no Supabase; no banco local
-- (sem a publicação) não faz nada.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tarefa, public.atribuicao, public.item;
  end if;
end $$;
