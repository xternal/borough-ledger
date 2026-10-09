import "server-only";
import { getDb, loadConfig, mailerFor, type Config, type Db, type Mailer } from "@borough-ledger/server";

/**
 * One place where route handlers get the server for email alerts: configuration,
 * the database (Neon in production, PGlite locally) and the mailer (Resend in
 * production, the outbox table locally). Route handlers using it set
 * `runtime = "nodejs"`. Nothing here runs while email is off.
 */
export interface Server {
  config: Config;
  db: Db;
  mail: Mailer;
}

// On globalThis for the same reason as getDb: Next.js may load this module more than once.
const g = globalThis as typeof globalThis & { __boroughServer?: Promise<Server> | null };

export function getServer(): Promise<Server> {
  g.__boroughServer ??= (async () => {
    const config = loadConfig();
    const db = await getDb(config);
    return { config, db, mail: mailerFor(config, db) };
  })().catch((e) => {
    g.__boroughServer = null; // try again on the next request rather than caching the failure
    throw e;
  });
  return g.__boroughServer;
}
