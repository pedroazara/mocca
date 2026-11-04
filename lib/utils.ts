import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes));
}

// "1 contato novo", "3 contatos novos": escolhe a forma pelo número.
export function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}
