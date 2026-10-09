import { createHmac, timingSafeEqual } from "node:crypto";
import type { Config } from "./config";
import type { Db } from "./db";
import { lookupHash, normaliseEmail } from "./crypto";

/** How far a webhook's timestamp may be from our clock: older or newer requests are refused as possible replays. */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export interface WebhookHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

/**
 * Resend signs webhooks the Svix way: HMAC-SHA256 over "<id>.<timestamp>.<raw body>",
 * keyed with the base64 part of the "whsec_…" secret, sent as one or more
 * space-separated "v1,<base64>" values. Compared in constant time.
 */
export function verifyResendSignature(secret: string, h: WebhookHeaders, body: string, now = new Date()): boolean {
  if (!h.id || !h.timestamp || !h.signature) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now.getTime() / 1000 - ts) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${h.id}.${h.timestamp}.${body}`).digest();
  return h.signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export type MailEventResult = { action: "removed" | "none"; kind: "bounce" | "complaint" | "other" };

/**
 * A bounce or complaint from the mail provider. A permanent bounce (the address
 * does not exist or refuses our mail) or a spam complaint deletes the email
 * subscription for that address at once, with everything it follows: we stop
 * writing to people who cannot or do not want to receive our alerts. Temporary
 * bounces and other events change nothing. Nothing from the event is stored.
 */
export async function handleResendEvent(ctx: { db: Db; config: Config; now?: Date }, event: unknown): Promise<MailEventResult> {
  const e = event as { type?: unknown; data?: { to?: unknown; bounce?: { type?: unknown } } } | null;
  const type = typeof e?.type === "string" ? e.type : "";
  const kind = type === "email.complained" ? "complaint" : type === "email.bounced" && e?.data?.bounce?.type === "Permanent" ? "bounce" : "other";
  if (kind === "other") return { action: "none", kind };

  const to = Array.isArray(e?.data?.to) ? (e!.data!.to as unknown[]).filter((a): a is string => typeof a === "string") : [];
  let removed = 0;
  for (const address of to) {
    const hash = lookupHash(ctx.config.lookupPepper, "email", normaliseEmail(bareAddress(address)));
    const rows = await ctx.db.query<{ id: string }>("DELETE FROM subscription WHERE address_hash = $1 RETURNING id", [hash]);
    removed += rows.length;
  }
  return { action: removed > 0 ? "removed" : "none", kind };
}

/** "Name <a@b.c>" → "a@b.c"; a bare address is returned as it is. */
function bareAddress(address: string): string {
  const m = /<([^<>]+)>\s*$/.exec(address);
  return (m ? m[1]! : address).trim();
}
