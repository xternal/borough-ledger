import type { Config } from "./config";
import { MIGRATIONS } from "./migrations";

/**
 * The smallest database interface the services need. Two adapters: node-postgres
 * for production (Neon) and PGlite (in-process Postgres) for development and tests.
 * SQL uses $1, $2… placeholders, which both accept.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run statements atomically. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function migrate(db: Db): Promise<string[]> {
  await db.query("CREATE TABLE IF NOT EXISTS schema_migration (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const done = new Set((await db.query<{ id: string }>("SELECT id FROM schema_migration")).map((r) => r.id));
  const applied: string[] = [];
  for (const [id, sql] of MIGRATIONS) {
    if (done.has(id)) continue;
    await db.transaction(async (tx) => {
      for (const statement of splitSql(sql)) await tx.query(statement);
      await tx.query("INSERT INTO schema_migration (id) VALUES ($1)", [id]);
    });
    applied.push(id);
  }
  return applied;
}

/** Split a migration file into statements (our migrations have no "--" or ";" inside strings or functions). */
function splitSql(sql: string): string[] {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function pgliteDb(dir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dir !== ":memory:") (await import("node:fs")).mkdirSync(dir, { recursive: true });
  const pg = dir === ":memory:" ? new PGlite() : new PGlite(dir);
  const wrap = (q: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): Db => ({
    async query<T>(sql: string, params: unknown[] = []) {
      return (await q.query(sql, params)).rows as T[];
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      return pg.transaction(async (tx) => fn(wrap(tx as never))) as Promise<T>;
    },
    async close() {
      await pg.close();
    },
  });
  return wrap(pg as never);
}

export async function postgresDb(url: string): Promise<Db> {
  const { default: pgmod } = await import("pg");
  const pool = new pgmod.Pool({ connectionString: url, max: 3, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: true } });
  const db: Db = {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pool.query(sql, params)).rows as T[];
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const tx: Db = {
          query: async <R>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as R[],
          transaction: (inner) => inner(tx),
          close: async () => undefined,
        };
        const out = await fn(tx);
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
  return db;
}

/**
 * One database per process, migrated on first use. Kept on globalThis because
 * Next.js can load this module more than once (pages, route handlers, env
 * reloads), and two PGlite instances on one folder corrupt it.
 */
const g = globalThis as typeof globalThis & { __boroughDb?: Promise<Db> | null };

export function getDb(config: Config): Promise<Db> {
  g.__boroughDb ??= (async () => {
    const db = config.databaseUrl ? await postgresDb(config.databaseUrl) : await pgliteDb(config.pgliteDir);
    await migrate(db);
    return db;
  })().catch((e) => {
    g.__boroughDb = null; // try again on the next call rather than caching the failure
    throw e;
  });
  return g.__boroughDb;
}

/** A fresh, migrated in-memory database for tests. */
export async function testDb(): Promise<Db> {
  const db = await pgliteDb(":memory:");
  await migrate(db);
  return db;
}
