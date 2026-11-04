import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes));
}

// "1 contato novo", "3 contatos novos": escolhe a forma pelo número.
export function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

// Iniciais do avatar: primeira letra do primeiro e do último nome, sem o "Prof.".
export function iniciais(nome: string) {
  const partes = nome.replace(/^Prof\.\s*/, "").split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}
