import "server-only";

// Acesso ao banco do painel. Toda consulta roda dentro de uma transação com o
// papel e o usuário certos, então quem decide o que cada um vê e altera é o RLS
// do Postgres (seção 10.3), não a interface.
//
// Dois modos:
// - produção: DATABASE_URL aponta para o Postgres do Supabase (pooler);
// - local: sem DATABASE_URL, um Postgres embutido (PGlite) em .dados-locais/,
//   criado com as mesmas migrações, o seed e os dados de exemplo.

export type Linha = Record<string, unknown>;
export type Consulta = <T = Linha>(sql: string, params?: unknown[]) => Promise<T[]>;

type Papel = "authenticated" | "service_role";
type Executor = <T>(claims: Record<string, unknown>, papel: Papel, fn: (q: Consulta) => Promise<T>) => Promise<T>;

export const modoLocal = !process.env.DATABASE_URL;

// O modo local nunca roda num deploy: sem DATABASE_URL em produção, o painel avisa.
export const modoLocalPermitido =
  modoLocal && (process.env.NODE_ENV !== "production" || process.env.MOCCA_MODO_LOCAL === "1");

export class BancoIndisponivel extends Error {
  constructor() {
    super("Banco de dados não configurado (DATABASE_URL).");
  }
}

let executor: Promise<Executor> | null = null;

function obterExecutor(): Promise<Executor> {
  if (!executor) {
    if (modoLocal) {
      if (!modoLocalPermitido) throw new BancoIndisponivel();
      executor = import("./local").then((m) => m.executar as Executor);
    } else {
      executor = import("./remoto").then((m) => m.executar as Executor);
    }
  }
  return executor;
}

// Consulta como a pessoa logada (auth.users.id). Respeita o RLS.
export async function comoUsuario<T>(authId: string, fn: (q: Consulta) => Promise<T>): Promise<T> {
  const executar = await obterExecutor();
  return executar({ sub: authId, role: "authenticated" }, "authenticated", fn);
}

// Consulta como o servidor (service role): ignora o RLS. Só para rotas que já
// validaram quem está chamando (formulário com Turnstile, API do Claude com token)
// e para ler o que já é público (foto e LinkedIn da página Equipe).
export async function comoServico<T>(fn: (q: Consulta) => Promise<T>, origem?: string): Promise<T> {
  const executar = await obterExecutor();
  return executar({ role: "service_role", ...(origem ? { origem } : {}) }, "service_role", fn);
}

// Datas do banco viram texto ISO, para passarem iguais do servidor para a tela.
export function normalizar<T>(linhas: T[]): T[] {
  for (const l of linhas as Record<string, unknown>[]) {
    for (const k in l) if (l[k] instanceof Date) l[k] = (l[k] as Date).toISOString();
  }
  return linhas;
}

// Traduz erros do Postgres em mensagens para a pessoa.
export function mensagemDeErro(e: unknown): string {
  const texto = e instanceof Error ? e.message : String(e);
  if (/row-level security|permission denied/i.test(texto)) return "Você não tem permissão para fazer isso.";
  if (/documento_url_check|url ~/i.test(texto)) return "Use um link do Google Drive ou do Google Docs.";
  if (/duplicate key/i.test(texto)) return "Isso já existe.";
  if (/violates check constraint/i.test(texto)) return "Algum valor está fora do permitido.";
  console.error("[banco]", e);
  return "Algo deu errado ao salvar. Tente de novo.";
}
