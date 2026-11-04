import { z } from "zod";

// Regras do login por e-mail e senha, usadas na tela e nas ações do servidor.

export const SENHA_MINIMA = 8;

export const esquemaEmail = z.string().trim().toLowerCase().pipe(z.email());

export const esquemaSenhaNova = z.string().min(SENHA_MINIMA).max(72);

// Primeiro acesso: liga a conta recém-criada (auth.users) à pessoa da equipe, se
// ela está ativa e ainda não tem conta. Nenhuma linha devolvida = não ligou.
// A ligação é só esta, feita pelo servidor: um cadastro que apareça direto em
// auth.users não vira acesso ao painel (DUVIDAS 27).
// $1 = id da conta (auth.users.id), $2 = e-mail em minúsculas. Aceita a pessoa já
// ligada a esta mesma conta: enquanto a migração 20261104130000 não estiver no
// banco, o gatilho antigo liga primeiro, e o primeiro acesso não pode falhar.
export const SQL_LIGAR_CONTA =
  "update pessoa set auth_id = $1 where lower(email) = $2 and (auth_id is null or auth_id = $1) and ativo returning id";
