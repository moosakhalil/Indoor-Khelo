import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __ikPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  return new Pool({ connectionString, max: 5, idleTimeoutMillis: 20_000 });
}

export const pool: Pool = globalThis.__ikPool ?? (globalThis.__ikPool = createPool());

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs several statements in one transaction. Rolls back if anything throws. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    try { await client.query("rollback"); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export function isCommunityFull(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { message?: string }).message === "community_full";
}
