-- O registro de e-mails entra no Realtime: quando o aviso automático sai, segundos
-- depois da atribuição, a janela da tarefa e a tela Semana passam de "ainda não
-- enviado" para "enviado" sozinhas. Só existe no Supabase; no banco local não faz nada.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.email_enviado;
  end if;
end $$;
