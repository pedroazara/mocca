import { z } from "zod";

// Regras do login por e-mail e senha, usadas na tela e nas ações do servidor.

export const SENHA_MINIMA = 8;

export const esquemaEmail = z.string().trim().toLowerCase().pipe(z.email());

export const esquemaSenhaNova = z.string().min(SENHA_MINIMA).max(72);
