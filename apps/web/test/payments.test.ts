import { describe, expect, it } from "vitest";
import { buildModel } from "@/lib/model";
import { MONTHS, PAY, monthFile, suppliersById } from "@/lib/payments";

describe("payments", () => {
  const m = buildModel();

  it("summarises the latest three months from the council's files", () => {
    const last3 = PAY.months.slice(-3);
    expect(m.payments.from).toBe(last3[0]!.month);
    expect(m.payments.total.value).toBeCloseTo(last3.reduce((a, x) => a + x.total, 0), 2);
    expect(m.payments.total.quality).toBe("sourced");
    expect(m.payments.total.sources.length).toBeGreaterThan(0);
    const tops = m.payments.top.map((t) => t.total.value);
    expect(tops).toEqual([...tops].sort((a, z) => z - a));
  });

  it("every month file adds up to the index", () => {
    for (const mo of MONTHS) {
      const f = monthFile(mo);
      const idx = PAY.months.find((x) => x.month === mo)!;
      expect(f.rows.length).toBe(idx.published_rows);
      expect(f.rows.reduce((a, r) => a + r[2], 0)).toBeCloseTo(idx.published_total, 2);
      expect(f.withheld.reduce((a, w) => a + w.total, 0)).toBeCloseTo(idx.withheld_total, 2);
      expect(f.rows.every((r) => r[0].startsWith(mo))).toBe(true);
    }
  });

  it("never names anyone the council or we withheld", () => {
    const names = [...suppliersById().values()].map((s) => s.name);
    expect(names.some((n) => /redacted/i.test(n) && !/redactive/i.test(n))).toBe(false);
    expect(names.some((n) => /^(mr|mrs|miss|ms)\.?\s/i.test(n))).toBe(false);
    expect(names.some((n) => /\bt\/a\b/i.test(n))).toBe(false); // sole traders appear by trading name only
  });

  it("gives pages only to companies, charities and public bodies", () => {
    for (const s of suppliersById().values()) expect(s.page).toBe(s.kind !== "other");
  });
});
