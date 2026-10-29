-- Gatilhos (seção 10.2): atualizado_em, concluido_em, histórico e ligação com auth.users.

-- Quem está agindo: a pessoa logada, ou null quando for a API (service role).
create function autor_atual() returns uuid
language sql stable security definer set search_path = public as $$
  select id from pessoa where auth_id = auth.uid()
$$;

-- A API do Claude usa o service role. O formulário do site também, mas marca a
-- transação com mocca.origem = 'site' (ver registrar_contato), e aí não conta como API.
create function via_api() returns boolean
language sql stable as $$
  select coalesce(auth.role(), '') = 'service_role'
     and coalesce(current_setting('mocca.origem', true), '') <> 'site'
$$;

create function tg_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create trigger tarefa_atualizado_em
  before update on tarefa
  for each row execute function tg_atualizado_em();

create function tg_concluido_em() returns trigger
language plpgsql as $$
begin
  if new.status = 'feito' then
    if tg_op = 'INSERT' or old.status is distinct from 'feito' then
      new.concluido_em := now();
    end if;
  else
    new.concluido_em := null;
  end if;
  return new;
end $$;

create trigger tarefa_concluido_em
  before insert or update of status on tarefa
  for each row execute function tg_concluido_em();

create function tg_item_feito_em() returns trigger
language plpgsql as $$
begin
  if new.feito then
    if tg_op = 'INSERT' or not old.feito then
      new.feito_em := now();
    end if;
  else
    new.feito_em := null;
  end if;
  return new;
end $$;

create trigger item_feito_em
  before insert or update of feito on item
  for each row execute function tg_item_feito_em();

-- Histórico ---------------------------------------------------------------

create function registrar_historico(p_tarefa uuid, p_acao text, p_detalhe jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- numa exclusão em cascata a tarefa já não existe: não há o que registrar
  if not exists (select 1 from tarefa where id = p_tarefa) then
    return;
  end if;
  insert into historico (tarefa_id, autor_id, via_api, acao, detalhe)
  values (p_tarefa, autor_atual(), via_api(), p_acao, p_detalhe);
end $$;

create function tg_historico_tarefa() returns trigger
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
  return new;
end $$;

create trigger tarefa_historico
  after insert or update of status, prazo on tarefa
  for each row execute function tg_historico_tarefa();

create function tg_historico_atribuicao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform registrar_historico(new.tarefa_id, 'atribuiu',
      jsonb_build_object('pessoa_id', new.pessoa_id, 'papel', new.papel));
    return new;
  end if;
  perform registrar_historico(old.tarefa_id, 'desatribuiu',
    jsonb_build_object('pessoa_id', old.pessoa_id, 'papel', old.papel));
  return old;
end $$;

create trigger atribuicao_historico
  after insert or delete on atribuicao
  for each row execute function tg_historico_atribuicao();

create function tg_historico_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tarefa uuid;
  v_pessoa uuid;
begin
  if new.feito is not distinct from old.feito then
    return new;
  end if;
  select tarefa_id, pessoa_id into v_tarefa, v_pessoa from atribuicao where id = new.atribuicao_id;
  perform registrar_historico(v_tarefa, case when new.feito then 'item_feito' else 'item_reaberto' end,
    jsonb_build_object('item_id', new.id, 'texto', new.texto, 'pessoa_id', v_pessoa));
  return new;
end $$;

create trigger item_historico
  after update of feito on item
  for each row execute function tg_historico_item();

-- Ligação auth.users -> pessoa pelo e-mail ---------------------------------

-- No primeiro login (usuário novo em auth.users)
create function tg_ligar_pessoa_ao_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update pessoa set auth_id = new.id
   where lower(email) = lower(new.email) and auth_id is null;
  return new;
end $$;

create trigger ligar_pessoa_ao_usuario
  after insert on auth.users
  for each row execute function tg_ligar_pessoa_ao_usuario();

-- Quando o admin cadastra (ou corrige o e-mail de) alguém que já entrou antes
create function tg_ligar_usuario_a_pessoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.email is distinct from old.email then
    new.auth_id := null;
  end if;
  if new.auth_id is null then
    select id into new.auth_id from auth.users where lower(email) = lower(new.email) limit 1;
  end if;
  return new;
end $$;

create trigger ligar_usuario_a_pessoa
  before insert or update of email on pessoa
  for each row execute function tg_ligar_usuario_a_pessoa();
