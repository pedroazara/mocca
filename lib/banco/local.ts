import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizar, type Consulta } from "./index";

// Postgres embutido para desenvolvimento. Na primeira vez, cria o banco em
// .dados-locais/pg com a simulação do Supabase, as migrações, o seed, os dados
// de exemplo e um usuário de login para cada pessoa da equipe.

const raiz = process.cwd();
const pasta = join(raiz, ".dados-locais", "pg");

type Global = typeof globalThis & { __moccaPglite?: Promise<PGlite> };
const g = globalThis as Global;

async function criar() {
  mkdirSync(pasta, { recursive: true });
  const db = new PGlite(pasta);
  await db.waitReady;
  const pronto = await db.query<{ ok: string | null }>("select to_regclass('public.pessoa')::text as ok");
  if (!pronto.rows[0]?.ok) {
    const ler = (...p: string[]) => readFileSync(join(raiz, "supabase", ...p), "utf8");
    await db.exec(ler("local", "auth-stub.sql"));
    const migracoes = readdirSync(join(raiz, "supabase", "migrations")).sort();
    for (const m of migracoes) await db.exec(ler("migrations", m));
    await db.exec(ler("seed.sql"));
    await db.exec(ler("seed-dev.sql"));
    // um "login" por pessoa; o gatilho liga auth.users -> pessoa pelo e-mail
    await db.exec("insert into auth.users (email) select email from pessoa");
    console.log("[banco local] criado em .dados-locais/pg com os dados de exemplo");
  }
  return db;
}

function banco() {
  g.__moccaPglite ??= criar();
  return g.__moccaPglite;
}

export async function executar<T>(
  claims: Record<string, unknown>,
  papel: "authenticated" | "service_role",
  fn: (q: Consulta) => Promise<T>,
): Promise<T> {
  const db = await banco();
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    if (claims.origem) await tx.query("select set_config('mocca.origem', $1, true)", [String(claims.origem)]);
    await tx.exec(`set local role ${papel}`);
    const q: Consulta = async (sql, params = []) => normalizar((await tx.query(sql, params as unknown[])).rows) as never;
    return fn(q);
  });
}
