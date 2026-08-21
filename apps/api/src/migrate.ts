import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { getDbConfig } from "./env.ts";

const MIGRATIONS_DIR = resolve(import.meta.dirname, "../../../database/migrations");

function migrationId(fileName: string): string {
  return fileName.replace(/\.sql$/i, "");
}

export async function applyMigrations(): Promise<{ ok: boolean; applied: string[]; error?: string }> {
  const config = getDbConfig();
  if (!config.configured) return { ok: false, applied: [], error: "DATABASE_URL is not set" };
  const client = new pg.Client({ connectionString: config.url, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const done = new Set(
      (await client.query("SELECT id FROM schema_migrations")).rows.map((row) => String(row.id)),
    );
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const applied: string[] = [];
    for (const file of files) {
      const id = migrationId(file);
      if (done.has(id)) continue;
      const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
      await client.query(sql);
      applied.push(id);
    }
    return { ok: true, applied };
  } catch (error) {
    const message = error instanceof Error ? error.message : "migration failed";
    return { ok: false, applied: [], error: message.split("\n")[0] };
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (import.meta.filename === process.argv[1] || process.argv[1]?.endsWith("migrate.ts")) {
  const result = await applyMigrations();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
