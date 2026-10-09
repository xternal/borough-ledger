import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Email addresses are stored only encrypted (AES-256-GCM)
 * plus an HMAC lookup hash, so the service can find "this address" without
 * decrypting anything, and a database leak alone reveals no addresses.
 */

const IV_BYTES = 12;
const TAG_BYTES = 16;

export function encrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decrypt(key: Buffer, encoded: string): string {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = raw.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Stable lookup hash for an address on a channel. */
export function lookupHash(pepper: Buffer, channel: string, address: string): string {
  return createHmac("sha256", pepper).update(`${channel}:${address}`).digest("base64url");
}

/** A random URL-safe token (sent to the person) and its hash (stored). */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHmac("sha256", "borough-token").update(token).digest("base64url");
}

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
