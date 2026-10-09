import { createHmac, randomBytes } from "node:crypto";
import type { Config } from "./config";
import type { Db } from "./db";

/**
 * Abuse controls for the public forms, without storing IPs or using a
 * third-party CAPTCHA (docs/PRIVACY.md):
 * - ALTCHA: a small proof-of-work the browser solves; self-hosted, no cookies.
 * - Rate limits per HMAC(day's random salt, IP). The salt is deleted once the
 *   day is over, so yesterday's hashes can no longer be linked to anyone.
 */

const CHALLENGE_TTL_SECONDS = 10 * 60;

async function altcha() {
  const lib = await import("altcha-lib");
  const { deriveKey } = await import("altcha-lib/algorithms/pbkdf2");
  return { ...lib, deriveKey };
}

/**
 * Difficulty: about 1–2 seconds on a mid-range phone, solved in the background
 * while the reader fills in the form. Rate limits are the second line of defence.
 */
export async function createSpamChallenge(config: Config, difficulty = { cost: 2_000, counter: [1_000, 3_000] as [number, number] }) {
  const { createChallenge, randomInt, deriveKey } = await altcha();
  return createChallenge({
    algorithm: "PBKDF2/SHA-256",
    cost: difficulty.cost,
    counter: randomInt(difficulty.counter[0], difficulty.counter[1]),
    deriveKey,
    expiresAt: Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS,
    hmacSignatureSecret: config.altchaKey,
    hmacKeySignatureSecret: `${config.altchaKey}:key`,
  });
}

/**
 * Verify the widget's payload (base64 JSON of { challenge, solution }). Each
 * solved challenge is accepted once.
 */
export async function verifySpamCheck(db: Db, config: Config, payload: unknown): Promise<boolean> {
  if (typeof payload !== "string" || payload.length > 10_000) return false;
  let decoded: { challenge?: { signature?: string; parameters?: { expiresAt?: number } }; solution?: unknown };
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return false;
  }
  if (!decoded.challenge?.signature || !decoded.solution) return false;
  const { verifySolution, deriveKey } = await altcha();
  const result = await verifySolution({
    challenge: decoded.challenge as never,
    solution: decoded.solution as never,
    deriveKey,
    hmacSignatureSecret: config.altchaKey,
    hmacKeySignatureSecret: `${config.altchaKey}:key`,
  });
  if (!result.verified) return false;
  const expires = new Date((decoded.challenge.parameters?.expiresAt ?? Date.now() / 1000 + CHALLENGE_TTL_SECONDS) * 1000);
  const fresh = await db.query("INSERT INTO altcha_used (signature, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING signature", [
    decoded.challenge.signature,
    expires.toISOString(),
  ]);
  return fresh.length === 1;
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function saltFor(db: Db, day: string): Promise<string> {
  await db.query("INSERT INTO daily_salt (day, salt) VALUES ($1, $2) ON CONFLICT (day) DO NOTHING", [day, randomBytes(32).toString("base64")]);
  const [row] = await db.query<{ salt: string }>("SELECT salt FROM daily_salt WHERE day = $1", [day]);
  return row!.salt;
}

/** Today's bucket for a client: HMAC(day's salt, client key). */
async function bucketFor(db: Db, clientKey: string, now: Date): Promise<{ day: string; bucket: string }> {
  const day = utcDay(now);
  return { day, bucket: createHmac("sha256", await saltFor(db, day)).update(clientKey).digest("base64url") };
}

/**
 * Count one `action` for this client today and say whether it is within `limit`.
 * `clientKey` is the request IP (or any per-client string); it is never stored.
 */
export async function rateLimit(db: Db, clientKey: string, action: string, limit: number, now = new Date()): Promise<boolean> {
  const { day, bucket } = await bucketFor(db, clientKey, now);
  const [row] = await db.query<{ count: number }>(
    `INSERT INTO rate_bucket (day, bucket_hash, action, count) VALUES ($1, $2, $3, 1)
     ON CONFLICT (day, bucket_hash, action) DO UPDATE SET count = rate_bucket.count + 1
     RETURNING count`,
    [day, bucket, action],
  );
  return Number(row!.count) <= limit;
}

/** How many times this client has done `action` today, without counting one more. */
export async function rateCount(db: Db, clientKey: string, action: string, now = new Date()): Promise<number> {
  const { day, bucket } = await bucketFor(db, clientKey, now);
  const [row] = await db.query<{ count: number }>("SELECT count FROM rate_bucket WHERE day = $1 AND bucket_hash = $2 AND action = $3", [day, bucket, action]);
  return Number(row?.count ?? 0);
}

/** Delete past salts and buckets and expired challenges. Run daily (the alerts job). */
export async function pruneSpamState(db: Db, now = new Date()): Promise<void> {
  const day = utcDay(now);
  await db.query("DELETE FROM daily_salt WHERE day < $1", [day]);
  await db.query("DELETE FROM rate_bucket WHERE day < $1", [day]);
  await db.query("DELETE FROM altcha_used WHERE expires_at < $1", [now.toISOString()]);
}

/** The client key for rate limiting: the first address in x-forwarded-for (set by Vercel), else a constant. */
export function clientKeyFrom(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
