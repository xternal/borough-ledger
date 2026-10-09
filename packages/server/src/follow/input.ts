import { type Target, parseTarget } from "./targets";

/**
 * Validation of what readers send to the follow endpoint. Hand-written so the
 * server package needs no schema library; the shape is small and every field
 * is checked.
 */

const MAX_TARGETS = 20;
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,189}\.[^\s@<>()[\]\\,;:".]{2,63}$/;

export function isEmail(x: unknown): x is string {
  return typeof x === "string" && x.trim().length <= 254 && EMAIL.test(x.trim());
}

/** Tokens are 24 random bytes, base64url (32 characters). Anything else is rejected before hashing. */
export function isTokenShape(x: unknown): x is string {
  return typeof x === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(x);
}

export interface FollowRequest {
  email: string;
  targets: Target[];
  altcha: string;
}

export type ParseResult = { ok: true; value: FollowRequest } | { ok: false; field: "email" | "targets" | "altcha" | "body" };

/** Body of POST /api/follow: { email, targets: [{ kind, id }], altcha }. */
export function parseFollowRequest(body: unknown): ParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, field: "body" };
  const b = body as Record<string, unknown>;
  if (!isEmail(b.email)) return { ok: false, field: "email" };
  if (!Array.isArray(b.targets) || b.targets.length === 0 || b.targets.length > MAX_TARGETS) return { ok: false, field: "targets" };
  const targets: Target[] = [];
  for (const raw of b.targets) {
    const t = parseTarget(raw);
    if (!t) return { ok: false, field: "targets" };
    if (!targets.some((x) => x.kind === t.kind && x.id === t.id)) targets.push(t);
  }
  if (typeof b.altcha !== "string" || !b.altcha) return { ok: false, field: "altcha" };
  return { ok: true, value: { email: b.email.trim(), targets, altcha: b.altcha } };
}
