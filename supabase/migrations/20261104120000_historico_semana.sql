-- Histórico: a troca de semana entra no histórico da tarefa ("passou da semana 3
-- para a 4"), agora que a tela Semana passa tarefas de uma semana para outra
-- (DUVIDAS 4m). O detalhe guarda os números das semanas, não os ids.

create or replace function tg_historico_tarefa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform registrar_historico(new.id, 'criou', jsonb_build_object('origem', new.origem));
    return new;
  end if;
  if new.status is distinct from old.status then
    perform registrar_historico(new.id, 'status', jsonb_build_object('de', old.status, 'para', new.status));
  end if;
  if new.prazo is distinct from old.prazo then
    perform registrar_historico(new.id, 'prazo', jsonb_build_object('de', old.prazo, 'para', new.prazo));
  end if;
  if new.semana_id is distinct from old.semana_id then
    perform registrar_historico(new.id, 'semana', jsonb_build_object(
      'de', (select numero from semana where id = old.semana_id),
      'para', (select numero from semana where id = new.semana_id)));
  end if;
  return new;
end $$;

drop trigger tarefa_historico on tarefa;
create trigger tarefa_historico
  after insert or update of status, prazo, semana_id on tarefa
  for each row execute function tg_historico_tarefa();
