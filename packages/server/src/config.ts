/**
 * Server configuration for email alerts, all from environment variables.
 *
 * Email is off unless MAIL_PROVIDER says otherwise, so the site builds and runs
 * with no database and no secrets, and shows only RSS. To switch it on in
 * production the owner sets every secret below (docs/EMAIL_ALERTS.md):
 * MAIL_PROVIDER=resend, DATABASE_URL (Neon, London region), FOLLOW_CONTROLLER,
 * BB_ENCRYPTION_KEY, BB_LOOKUP_PEPPER, ALTCHA_HMAC_KEY, MAIL_FROM,
 * RESEND_API_KEY and CRON_SECRET. A missing one stops the build with its name.
 *
 * MAIL_PROVIDER=outbox is for development: an in-process Postgres (PGlite)
 * and a mail_outbox table instead of sending, so every flow runs without
 * accounts. It is refused on a production deployment.
 */

export type MailProvider = "resend" | "outbox" | "off";

export interface Config {
  /** True on a deployment that sends real email: every secret is required. */
  production: boolean;
  /** Public origin used in links in emails, e.g. https://boroughbook.uk */
  siteUrl: string;
  /** Postgres connection string; unset in development means PGlite. */
  databaseUrl: string | null;
  /** Directory for PGlite data in development; ":memory:" for tests. */
  pgliteDir: string;
  /** 32-byte key (base64) for AES-256-GCM encryption of addresses at rest. */
  encryptionKey: Buffer;
  /** Separate secret (base64) for HMAC lookup hashes, so lookups never need decryption. */
  lookupPepper: Buffer;
  /** HMAC key for ALTCHA challenges. */
  altchaKey: string;
  /** Who holds subscribers' data and is responsible for it (UK GDPR controller), named in the consent text. */
  controller: string;
  /** Where people write about their data. */
  contact: string;
  /**
   * "resend" sends real mail; "outbox" writes it to a table (development);
   * "off": no email at all, and the site shows only RSS.
   */
  mail: { provider: MailProvider; from: string; replyTo?: string; resendApiKey: string | null; resendWebhookSecret: string | null };
  /** Shared secret Vercel Cron sends to the daily alerts job; unset turns the job off. */
  cronSecret: string | null;
}

const DEV_KEY = Buffer.alloc(32, 7); // development only; never used when production is true

function required(name: string, value: string | undefined, production: boolean, fallback: string): string {
  if (value && value.trim().length) return value.trim();
  if (production) throw new Error(`${name} must be set to send email alerts (docs/EMAIL_ALERTS.md)`);
  return fallback;
}

function key(name: string, value: string | undefined, production: boolean): Buffer {
  if (!value) {
    if (production) throw new Error(`${name} must be set to send email alerts (32 random bytes, base64; docs/EMAIL_ALERTS.md)`);
    return DEV_KEY;
  }
  const buf = Buffer.from(value, "base64");
  if (buf.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded`);
  return buf;
}

export function mailProvider(env: Record<string, string | undefined> = process.env): MailProvider {
  const p = env.MAIL_PROVIDER?.trim();
  return p === "resend" ? "resend" : p === "outbox" ? "outbox" : "off";
}

/** Whether the site offers email alerts at all. Cheap and never throws: pages call it while building. */
export function emailEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return mailProvider(env) !== "off";
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const provider = mailProvider(env);
  const production = provider === "resend";
  if (provider === "outbox" && env.VERCEL_ENV === "production") throw new Error("MAIL_PROVIDER=outbox is for development; use resend or off in production");
  if (production && !env.DATABASE_URL) throw new Error("DATABASE_URL must be set to send email alerts (the local database cannot run on a serverless host)");
  return {
    production,
    siteUrl: required("NEXT_PUBLIC_SITE_URL", env.NEXT_PUBLIC_SITE_URL, production, "http://localhost:3000").replace(/\/$/, ""),
    databaseUrl: env.DATABASE_URL || null,
    pgliteDir: env.PGLITE_DIR || ".data/pglite",
    encryptionKey: key("BB_ENCRYPTION_KEY", env.BB_ENCRYPTION_KEY, production),
    lookupPepper: key("BB_LOOKUP_PEPPER", env.BB_LOOKUP_PEPPER, production),
    altchaKey: required("ALTCHA_HMAC_KEY", env.ALTCHA_HMAC_KEY, production, "dev-altcha-key"),
    controller: required("FOLLOW_CONTROLLER", env.FOLLOW_CONTROLLER, production, "The site's owner (development)"),
    contact: env.FOLLOW_CONTACT?.trim() || "boroughs@guzh.uk",
    mail: {
      provider,
      from: required("MAIL_FROM", env.MAIL_FROM, production, "Borough Book <alerts@localhost>"),
      replyTo: env.MAIL_REPLY_TO || undefined,
      resendApiKey: production ? required("RESEND_API_KEY", env.RESEND_API_KEY, true, "") : null,
      /** Signing secret of the Resend webhook (bounces and complaints); unset turns the endpoint off. */
      resendWebhookSecret: env.RESEND_WEBHOOK_SECRET || null,
    },
    cronSecret: production ? required("CRON_SECRET", env.CRON_SECRET, true, "") : env.CRON_SECRET || null,
  };
}
