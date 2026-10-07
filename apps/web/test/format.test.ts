import { describe, expect, it } from "vitest";
import { format, formatLever, formatPeriod } from "@/lib/format";

describe("format", () => {
  it("formats pounds and millions the British way", () => {
    expect(format("gbp2", 1519.51)).toBe("£1,519.51");
    expect(format("gbp0", 1013.0066)).toBe("£1,013");
    expect(format("m1", 80.7)).toBe("£80.7m");
    expect(format("pm1", 37_715_494.94)).toBe("£37.7m");
    expect(format("m0", 224)).toBe("£224m");
    expect(format("sm1", 7.5)).toBe("+£7.5m");
    expect(format("sm1", -3.3)).toBe("−£3.3m");
    expect(format("sm1", -1e-12)).toBe("£0.0m");
    expect(format("m1", -1e-12)).toBe("£0.0m");
  });
  it("shows small amounts in balance-it with enough precision not to look balanced", () => {
    expect(format("mAuto", 0.02693)).toBe("£0.03m");
    expect(format("mAuto", 10.97307)).toBe("£11.0m");
  });
  it("formats shares and percentages", () => {
    expect(format("share0", 0.3603)).toBe("36%");
    expect(format("pct2", 4.6899)).toBe("4.69%");
    expect(format("pence", 0.3603)).toBe("36p");
  });
  it("formats lever values", () => {
    expect(formatLever("%", 4.99, false)).toBe("4.99%");
    expect(formatLever("%", 5, false)).toBe("5%");
    expect(formatLever("%", 2.5, true)).toBe("+2.5%");
    expect(formatLever("%", -5, true)).toBe("−5%");
    expect(formatLever("£m", 3, false)).toBe("£3.0m");
  });
  it("names a period of months", () => {
    expect(formatPeriod("2026-07-02", "2026-09-28")).toBe("July to September 2026");
    expect(formatPeriod("2025-12-02", "2026-02-28")).toBe("December 2025 to February 2026");
    expect(formatPeriod("2026-07-02", "2026-07-28")).toBe("July 2026");
  });
});

describe("no middle dots in formatted output", () => {
  it("never produces ·", () => {
    for (const v of [0, 1.5, -2.25, 1234567.891])
      for (const f of ["gbp2", "gbp0", "m0", "m1", "mAuto", "sm1", "pct0", "pct1", "pct2", "share0", "share1", "pence", "int"] as const)
        expect(format(f, v)).not.toContain("·");
  });
});
