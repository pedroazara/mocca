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
--
-- ORDEM: aplique esta migração só DEPOIS de publicar o código que veio com ela
-- (o criarSenha que liga a conta pelo id da conta criada). O código de antes
-- dependia deste gatilho para ligar a conta: com a função vazia, o primeiro
-- acesso dele cria uma conta que não se liga à pessoa, e ela cai em "Acesso
-- negado". Depois de aplicada, não volte a Vercel para uma publicação anterior.
-- Se uma conta solta ficar para trás, apague-a em Authentication › Users e a
-- pessoa cria a senha de novo.

create or replace function tg_ligar_pessoa_ao_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  return new;
end $$;

-- Trocar o e-mail de alguém desliga a conta antiga (e o painel a apaga, em
-- atualizarPessoa); a pessoa cria a senha de novo com o e-mail novo. Só
-- maiúsculas e minúsculas diferentes não contam como troca. Cadastrar ou
-- corrigir uma pessoa nunca liga sozinho.
create or replace function tg_ligar_usuario_a_pessoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and lower(new.email) is distinct from lower(old.email) then
    new.auth_id := null;
  end if;
  return new;
end $$;
