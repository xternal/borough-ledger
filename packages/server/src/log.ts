/**
 * Error text that is safe to log. Provider errors can quote the recipient,
 * and we never log an address.
 */
export function errorText(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
  // Work on a bounded prefix, and redact any token holding an "@" as a whole: no regex here can backtrack.
  return raw
    .slice(0, 2000)
    .split(/([\s<>"'(),;:]+)/)
    .map((token) => (token.includes("@") ? "[address]" : token))
    .join("")
    .replace(/\b\d{6,}\b/g, "[number]")
    .slice(0, 300);
}
