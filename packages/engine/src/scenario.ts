import type { LeverId } from "@borough-ledger/schema";
import { defaultScenario, leverValue, type BalanceInput, type Scenario } from "./balance";

/**
 * Scenario links: only choices that differ from the starting position, in a short readable form.
 *   ct:5.5,sv:3,rs:2,off:weekly_bins.library_hours,on:extra_officers
 * Unknown keys and bad values are ignored, and lever values are clamped to their range and snapped to their step,
 * so a hand-edited or old link still opens something sensible.
 */
const CODE: Record<LeverId, string> = { ct_rise: "ct", savings: "sv", reserves: "rs", fees: "fe", settlement: "st" };
const LEVER = Object.fromEntries(Object.entries(CODE).map(([id, code]) => [code, id as LeverId])) as Record<string, LeverId>;

const round = (v: number) => Math.round(v * 10000) / 10000;

export function encodeScenario(input: BalanceInput, s: Scenario): string {
  const parts: string[] = [];
  for (const l of input.levers) {
    const v = leverValue(s, l);
    if (Math.abs(v - l.base) > 1e-9) parts.push(`${CODE[l.id]}:${round(v)}`);
  }
  const off = input.toggles.filter((t) => t.on && s.toggles[t.id] === false).map((t) => t.id);
  const on = input.toggles.filter((t) => !t.on && s.toggles[t.id] === true).map((t) => t.id);
  if (off.length) parts.push(`off:${off.join(".")}`);
  if (on.length) parts.push(`on:${on.join(".")}`);
  return parts.join(",");
}

export function decodeScenario(input: BalanceInput, raw: string | null | undefined): Scenario {
  const s = defaultScenario(input);
  if (!raw) return s;
  const toggles = new Set(input.toggles.map((t) => t.id));
  for (const part of raw.split(",")) {
    const [key, value] = part.split(":", 2);
    if (!key || value === undefined) continue;
    if (key === "off" || key === "on") {
      for (const id of value.split(".")) if (toggles.has(id)) s.toggles[id] = key === "on";
      continue;
    }
    const id = LEVER[key];
    const lever = id && input.levers.find((l) => l.id === id);
    const v = Number(value);
    if (!lever || !Number.isFinite(v)) continue;
    const snapped = lever.min + Math.round((v - lever.min) / lever.step) * lever.step;
    s.levers[lever.id] = round(Math.min(lever.max, Math.max(lever.min, snapped)));
  }
  return s;
}
