-- Formulário de contato do site (seção 6.6), numa transação só:
-- limite de 5 envios por IP por hora, grava o contato, cria a tarefa
-- "Responder contato: {nome}" na semana atual e atribui ao responsável configurado.
-- Chamada só pela rota /api/contato, com o service role.

create function registrar_contato(p_dados jsonb, p_ip_hash text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_hoje      date := (now() at time zone 'America/Sao_Paulo')::date;
  v_resp      uuid;
  v_semana    semana%rowtype;
  v_contato   uuid;
  v_tarefa    uuid;
  v_nome      text := btrim(p_dados->>'nome');
begin
  -- o histórico desta transação não conta como API do Claude (ver via_api)
  perform set_config('mocca.origem', 'site', true);

  if coalesce((p_dados->>'consentiu')::boolean, false) is not true then
    raise exception 'sem_consentimento' using errcode = '22023';
  end if;

  if p_ip_hash is not null and (
    select count(*) from contato
     where ip_hash = p_ip_hash and criado_em > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'limite_de_envios' using errcode = 'P0429';
  end if;

  select responsavel_contato_id into v_resp from configuracao where id = 1;

  insert into contato (nome, email, telefone, perfil, cidade_uf, area_ha, tipo_colheita,
                       mensagem, consentiu, responsavel_id, ip_hash)
  values (v_nome,
          lower(btrim(p_dados->>'email')),
          nullif(p_dados->>'telefone', ''),
          (p_dados->>'perfil')::perfil_contato,
          nullif(p_dados->>'cidade_uf', ''),
          (p_dados->>'area_ha')::numeric,
          nullif(p_dados->>'tipo_colheita', ''),
          p_dados->>'mensagem',
          true,
          v_resp,
          p_ip_hash)
  returning id into v_contato;

  select * into v_semana from semana where v_hoje between inicio and fim order by numero limit 1;

  insert into tarefa (titulo, status, semana_id, prazo, origem, contato_id, posicao)
  values (left('Responder contato: ' || v_nome, 200),
          'a_fazer',
          v_semana.id,
          -- prazo padrão = fim da semana (23:59 em Brasília)
          case when v_semana.id is not null
               then (v_semana.fim + time '23:59') at time zone 'America/Sao_Paulo' end,
          'contato',
          v_contato,
          extract(epoch from now()))
  returning id into v_tarefa;

  if v_resp is not null then
    insert into atribuicao (tarefa_id, pessoa_id, papel) values (v_tarefa, v_resp, 'responsavel');
  end if;

  return v_contato;
end $$;

revoke all on function registrar_contato(jsonb, text) from public, anon, authenticated;
grant execute on function registrar_contato(jsonb, text) to service_role;
