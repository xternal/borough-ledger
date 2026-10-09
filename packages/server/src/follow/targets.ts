/**
 * What can be followed by email: one pledge (`promise`, by its card id) or
 * every pledge (`all`, id "*"). The same for every party.
 */
export const TARGET_KINDS = ["promise", "all"] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];
export interface Target {
  kind: TargetKind;
  id: string;
}

/** Human name of a target, e.g. the pledge's words (resolved from content by the app). */
export type DescribeTarget = (t: Target) => string;

/** Promise ids are content file names: `[a-z0-9-]`. */
const CONTENT_ID = /^[a-z0-9][a-z0-9-]{0,99}$/;

export function isTargetKind(x: unknown): x is TargetKind {
  return typeof x === "string" && (TARGET_KINDS as readonly string[]).includes(x);
}

/** A well-formed target, or null. Says nothing about whether it exists in content. */
export function parseTarget(x: unknown): Target | null {
  if (!x || typeof x !== "object") return null;
  const { kind, id } = x as { kind?: unknown; id?: unknown };
  if (!isTargetKind(kind) || typeof id !== "string") return null;
  if (kind === "all") return id === "*" ? { kind, id } : null;
  return CONTENT_ID.test(id) ? { kind, id } : null;
}

export function sameTarget(a: Target, b: Target): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** Fallback names when the app does not supply content-based ones (tests, scripts). */
export const plainDescribe: DescribeTarget = (t) => (t.kind === "all" ? "Every pledge on Borough Book" : `Pledge ${t.id}`);
