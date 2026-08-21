import pg from "pg";
import { getDbConfig } from "./env.ts";

let pool: pg.Pool | null | undefined;

export function persistenceEnabled(): boolean {
  if (process.env.APPLIED_PRICES_DIR) return false;
  if (process.env.NODE_TEST_CONTEXT) return false;
  if (process.env.PRICE_UPDATE_STORE === "file") return false;
  return getDbConfig().configured;
}

export function getPool(): pg.Pool | null {
  if (!persistenceEnabled()) return null;
  if (pool !== undefined) return pool;
  const config = getDbConfig();
  if (!config.configured) {
    pool = null;
    return null;
  }
  pool = new pg.Pool({
    connectionString: config.url,
    max: 8,
    connectionTimeoutMillis: 4000,
  });
  return pool;
}

export async function withClient<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T | null> {
  const current = getPool();
  if (!current) return null;
  let client: pg.PoolClient;
  try {
    client = await current.connect();
  } catch {
    return null;
  }
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
