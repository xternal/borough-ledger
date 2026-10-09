import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** Compare a presented secret with the expected one in constant time (hashing first evens out the lengths). */
export function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
