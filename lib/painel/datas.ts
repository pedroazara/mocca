import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Semana } from "./tipos";

// Datas do painel: gravadas em UTC, mostradas no horário de Brasília (seção 3).

export const FUSO = "America/Sao_Paulo";

export function agoraBrasilia(agora: Date = new Date()) {
  return new TZDate(agora, FUSO);
}

// "YYYY-MM-DD" do dia de hoje em Brasília
export function hojeBrasilia(agora: Date = new Date()) {
  return format(agoraBrasilia(agora), "yyyy-MM-dd");
}

function emBrasilia(iso: string | Date) {
  return new TZDate(typeof iso === "string" ? new Date(iso) : iso, FUSO);
}

export function dataCurta(iso: string | Date) {
  return format(emBrasilia(iso), "dd/MM", { locale: ptBR });
}

export function dataHora(iso: string | Date) {
  return format(emBrasilia(iso), "dd/MM 'às' HH:mm", { locale: ptBR });
}

export function dataLonga(iso: string | Date) {
  return format(emBrasilia(iso), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

// Datas de calendário (coluna `date`, "YYYY-MM-DD"): sem conversão de fuso.
export function diaCurto(dia: string) {
  return format(parseISO(dia), "dd/MM");
}

// Semana do programa em que cai o dia (YYYY-MM-DD). Antes da primeira, a 1;
// depois da última, a última.
export function semanaDoDia<S extends Pick<Semana, "numero" | "inicio" | "fim">>(semanas: S[], dia: string) {
  if (semanas.length === 0) return null;
  const ordenadas = [...semanas].sort((a, b) => a.numero - b.numero);
  const dentro = ordenadas.find((s) => s.inicio <= dia && dia <= s.fim);
  if (dentro) return dentro;
  if (dia < ordenadas[0].inicio) return ordenadas[0];
  return ordenadas[ordenadas.length - 1];
}

export function semanaAtual<S extends Pick<Semana, "numero" | "inicio" | "fim">>(semanas: S[], agora = new Date()) {
  return semanaDoDia(semanas, hojeBrasilia(agora));
}

// Fim da semana às 23:59 de Brasília, em ISO (prazo padrão de uma tarefa).
export function fimDaSemanaIso(fim: string) {
  return fimDoDia(fim);
}

// 23:59 de Brasília no dia dado, em ISO UTC ("...Z"), igual ao que o banco devolve.
function fimDoDia(dia: string) {
  return new Date(new TZDate(`${dia}T23:59:00`, FUSO).getTime()).toISOString();
}

// Dias de calendário (Brasília) entre hoje e o prazo: negativo = atrasado.
export function diasAtePrazo(prazo: string, agora: Date = new Date()) {
  return differenceInCalendarDays(emBrasilia(prazo), agoraBrasilia(agora));
}

export function textoPrazo(prazo: string, agora: Date = new Date()) {
  const d = diasAtePrazo(prazo, agora);
  if (d < -1) return `atrasada há ${-d} dias`;
  if (d === -1) return "atrasada desde ontem";
  if (d === 0) return "vence hoje";
  if (d === 1) return "falta 1 dia";
  return `faltam ${d} dias`;
}

export function estaAtrasada(t: { prazo: string | null; status: string }, agora: Date = new Date()) {
  return Boolean(t.prazo) && t.status !== "feito" && new Date(t.prazo!).getTime() < agora.getTime();
}

// Valor para <input type="date"> a partir de um timestamp, no fuso de Brasília.
export function paraCampoData(iso: string | null) {
  return iso ? format(emBrasilia(iso), "yyyy-MM-dd") : "";
}

// De <input type="date"> para o prazo (fim do dia em Brasília).
export function deCampoData(valor: string) {
  return valor ? fimDoDia(valor) : null;
}

// Próxima ocorrência do dia/hora da reunião semanal, a partir de agora.
export function proximaReuniao(diaSemana: number | null, hora: string | null, agora: Date = new Date()) {
  if (diaSemana === null || !hora) return null;
  const base = agoraBrasilia(agora);
  const [h, m] = hora.split(":").map(Number);
  for (let i = 0; i < 8; i++) {
    const d = new TZDate(base.getFullYear(), base.getMonth(), base.getDate() + i, h, m, 0, FUSO);
    if (d.getDay() === diaSemana && d.getTime() > agora.getTime()) return d;
  }
  return null;
}
