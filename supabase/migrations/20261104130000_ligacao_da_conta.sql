-- Segurança (DUVIDAS 27): a conta de login só se liga à pessoa da equipe pelo
-- servidor, no primeiro acesso (app/entrar/acoes.ts, criarSenha), que confere se
-- a pessoa está ativa e liga pelo id da conta que acabou de criar.
--
-- Antes, dois gatilhos ligavam pelo e-mail qualquer conta que aparecesse em
-- auth.users, inclusive um cadastro feito direto na API de login do Supabase
-- enquanto o cadastro público estivesse ligado, e inclusive para pessoa
-- desativada. Assim, quem chegasse antes com o e-mail de alguém da equipe
-- ficava com a conta dela.
--
-- O gatilho em auth.users continua existindo (apagá-lo pede ser dono da tabela,
-- que é do Supabase), mas a função dele agora não faz nada.

create or replace function tg_ligar_pessoa_ao_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  return new;
end $$;

-- Trocar o e-mail de alguém desliga a conta antiga; a pessoa cria a senha de
-- novo com o e-mail novo. Cadastrar ou corrigir uma pessoa nunca liga sozinho.
create or replace function tg_ligar_usuario_a_pessoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.email is distinct from old.email then
    new.auth_id := null;
  end if;
  return new;
end $$;
