/** Number formats used across the site. Components pick a format by name; nothing formats by hand. */
export type Fmt =
  | "gbp2" // £1,519.51
  | "gbp0" // £1,013
  | "m0" // £224m
  | "m1" // £80.7m
  | "mAuto" // £80.7m, or £0.03m when under £0.1m
  | "pm1" // £37.7m from an amount in pounds (payments)
  | "sm1" // +£4.0m / −£3.3m
  | "pct0" // 36%   (input in percent units)
  | "pct1" // 4.7%
  | "pct2" // 4.69%
  | "share0" // 36%  (input as a fraction)
  | "share1" // 1.1% (input as a fraction)
  | "pence" // 66p  (input as a fraction of £1)
  | "int"; // 38

const MINUS = "−";
const cache = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number): Intl.NumberFormat {
  const k = `${min}:${max}`;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", { minimumFractionDigits: min, maximumFractionDigits: max });
    cache.set(k, f);
  }
  return f;
}

/** Avoid "−£0.0m" and "−0%" from tiny negative values. */
function clean(v: number, dp: number): number {
  const r = Number(v.toFixed(dp));
  return Object.is(r, -0) ? 0 : r;
}

function sign(v: number): string {
  return v < 0 ? MINUS : "";
}

export function format(fmt: Fmt, raw: number): string {
  switch (fmt) {
    case "gbp2": {
      const v = clean(raw, 2);
      return `${sign(v)}£${nf(2, 2).format(Math.abs(v))}`;
    }
    case "gbp0": {
      const v = clean(raw, 0);
      return `${sign(v)}£${nf(0, 0).format(Math.abs(v))}`;
    }
    case "m0":
    case "m1": {
      const dp = fmt === "m0" ? 0 : 1;
      const v = clean(raw, dp);
      return `${sign(v)}£${nf(dp, dp).format(Math.abs(v))}m`;
    }
    case "pm1":
      return format("m1", raw / 1e6);
    case "mAuto":
      return Math.abs(raw) > 0 && Math.abs(raw) < 0.1 ? `${sign(raw)}£${nf(2, 2).format(Math.abs(clean(raw, 2)))}m` : format("m1", raw);
    case "sm1": {
      const v = clean(raw, 1);
      return `${v > 0 ? "+" : v < 0 ? MINUS : ""}£${nf(1, 1).format(Math.abs(v))}m`;
    }
    case "pct0":
    case "pct1":
    case "pct2": {
      const dp = Number(fmt.slice(3));
      const v = clean(raw, dp);
      return `${sign(v)}${nf(dp, dp).format(Math.abs(v))}%`;
    }
    case "share0":
      return format("pct0", raw * 100);
    case "share1":
      return format("pct1", raw * 100);
    case "pence":
      return `${Math.round(raw * 100)}p`;
    case "int":
      return nf(0, 0).format(raw);
  }
}

/** Lever values: "4.99%", "5%", "+2.5%" for the settlement, "£3.0m". */
export function formatLever(unit: "%" | "£m", v: number, signed: boolean): string {
  if (unit === "£m") return format("m1", v);
  const s = nf(0, 2).format(Math.abs(v));
  return `${v < 0 ? MINUS : signed && v > 0 ? "+" : ""}${s}%`;
}

const MONTHS = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const formatDay = (iso: string) => DAY.format(utc(iso));
export const formatMonthYear = (iso: string) => MONTH_YEAR.format(utc(iso));
const MONTH_LONG = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
/** "2024-04" -> "April 2024". */
export const formatMonth = (ym: string) => MONTH_LONG.format(utc(`${ym}-01`));
/** "2024-04" -> "Apr 2024". */
export const formatMonthShort = (ym: string) => MONTH_YEAR.format(utc(`${ym}-01`));

/** "July to September 2026", or "December 2025 to February 2026". */
export function formatPeriod(fromIso: string, toIso: string): string {
  const a = utc(fromIso);
  const b = utc(toIso);
  const ya = a.getUTCFullYear();
  const yb = b.getUTCFullYear();
  if (ya === yb && a.getUTCMonth() === b.getUTCMonth()) return `${MONTHS.format(a)} ${ya}`;
  return ya === yb ? `${MONTHS.format(a)} to ${MONTHS.format(b)} ${yb}` : `${MONTHS.format(a)} ${ya} to ${MONTHS.format(b)} ${yb}`;
}
