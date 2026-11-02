// Arquivar tira a tarefa das listas, mas ela precisa continuar alcançável (a tela
// Arquivadas é o caminho de volta). Roda as consultas reais num Postgres embutido
// com as migrações e o seed.

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Consulta } from "@/lib/banco";

vi.mock("server-only", () => ({}));

const { tarefas } = await import("@/lib/painel/dados");
const { tarefasArquivadas } = await import("@/lib/painel/arquivadas");

const pasta = join(__dirname, "..", "supabase");
const ler = (...p: string[]) => readFileSync(join(pasta, ...p), "utf8");
const db = new PGlite();
const q = (async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows) as Consulta;

const nova = async (titulo: string) =>
  (
    await db.query<{ id: string }>(
      "insert into tarefa (titulo, semana_id) values ($1, (select id from semana where numero = 2)) returning id",
      [titulo],
    )
  ).rows[0].id;
const arquivar = (id: string, arquivada: boolean) => db.query("update tarefa set arquivada = $2 where id = $1", [id, arquivada]);

beforeAll(async () => {
  await db.exec(ler("local", "auth-stub.sql"));
  for (const f of readdirSync(join(pasta, "migrations")).sort()) await db.exec(ler("migrations", f));
  await db.exec(ler("seed.sql"));
});

describe("tarefas arquivadas", () => {
  it("sai das listas e aparece nas arquivadas, com semana e status", async () => {
    const id = await nova("Roteiro antigo");
    expect(await tarefasArquivadas(q)).toEqual([]);

    await arquivar(id, true);

    expect((await tarefas(q)).map((t) => t.id)).not.toContain(id);
    expect(await tarefasArquivadas(q)).toMatchObject([{ id, titulo: "Roteiro antigo", semana: 2, status: "a_fazer" }]);
  });

  it("ao restaurar, volta para as listas", async () => {
    const [{ id }] = await tarefasArquivadas(q);

    await arquivar(id, false);

    expect((await tarefas(q)).map((t) => t.id)).toContain(id);
    expect(await tarefasArquivadas(q)).toEqual([]);
  });

  it("uma tarefa sem semana também aparece", async () => {
    const { rows } = await db.query<{ id: string }>("insert into tarefa (titulo, arquivada) values ('Solta', true) returning id");
    expect(await tarefasArquivadas(q)).toMatchObject([{ id: rows[0].id, semana: null }]);
  });
});
