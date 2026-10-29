import "server-only";
import postgres from "postgres";
import { normalizar, type Consulta } from "./index";

// Postgres do Supabase (produção). Use a string de conexão do pooler em modo
// transação (porta 6543); por isso prepare: false. Cada chamada abre uma
// transação, define as "claims" e troca para o papel certo, como o PostgREST faz.

type Global = typeof globalThis & { __moccaSql?: ReturnType<typeof postgres> };
const g = globalThis as Global;

function conexao() {
  g.__moccaSql ??= postgres(process.env.DATABASE_URL!, { prepare: false, max: 5, idle_timeout: 20 });
  return g.__moccaSql;
}

export async function executar<T>(
  claims: Record<string, unknown>,
  papel: "authenticated" | "service_role",
  fn: (q: Consulta) => Promise<T>,
): Promise<T> {
  const sql = conexao();
  return sql.begin(async (tx) => {
    await tx.unsafe("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    if (claims.origem) await tx.unsafe("select set_config('mocca.origem', $1, true)", [String(claims.origem)]);
    await tx.unsafe(`set local role ${papel}`);
    const q: Consulta = async (texto, params = []) =>
      normalizar([...(await tx.unsafe(texto, params as postgres.ParameterOrJSON<never>[]))]) as never;
    return fn(q);
  }) as Promise<T>;
}
