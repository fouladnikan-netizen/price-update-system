import pg from "pg";
import { getDbConfig } from "./env.ts";

export type DatabaseHealth = {
  ok: boolean;
  configured: boolean;
  database?: string;
  migrations?: string[];
  error?: string;
};

export async function pingDatabase(): Promise<DatabaseHealth> {
  const config = getDbConfig();
  if (!config.configured) {
    return { ok: false, configured: false, error: "DATABASE_URL is not set" };
  }
  const client = new pg.Client({ connectionString: config.url, connectionTimeoutMillis: 4000 });
  try {
    await client.connect();
    const database = String((await client.query("SELECT current_database() AS db")).rows[0]?.db ?? "");
    let migrations: string[] = [];
    try {
      const raw = await client.query("SELECT id FROM schema_migrations ORDER BY applied_at");
      migrations = raw.rows.map((row) => String(row.id));
    } catch {
      migrations = [];
    }
    return { ok: true, configured: true, database, migrations };
  } catch (error) {
    const message = error instanceof Error ? error.message : "database ping failed";
    return { ok: false, configured: true, error: message.split("\n")[0] };
  } finally {
    await client.end().catch(() => undefined);
  }
}
