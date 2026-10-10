import { describe, expect, it } from "vitest";
import { billFor } from "@borough-ledger/engine";
import { riseQA, when } from "@/components/CouncilTaxRise";
import { buildModel } from "@/lib/model";

describe("next year's council tax options", () => {
  const m = buildModel();
  const ct = m.ctOptions!;

  it("are the report's Band D figures, and other bands follow by the statutory ratios", () => {
    expect(ct.options.map((o) => o.total.value)).toEqual([2554.04, 2806.29, 3058.54]);
    const now = billFor(m.rules, { council: m.bill.council.value, gla: m.bill.gla.value }, "D", false).total;
    expect(+((ct.options[0]!.total.value - now) / 52).toFixed(2)).toBe(19.89);
    const b = billFor(m.rules, { council: ct.options[0]!.council.value, gla: ct.options[0]!.gla.value }, "B", false).total;
    expect(+b.toFixed(2)).toBe(1986.48); // 7/9 of Band D
  });

  it("say plainly that the percentages are the council's share, not the whole bill", () => {
    const first = riseQA(m)[0]!.a;
    expect(first).toContain("raise the council's own share of the bill by 100%, 125% or 150%");
    expect(first).toContain("about 68%, 85% or 101%");
    expect(first).toContain("£2,554.04, £2,806.29 or £3,058.54");
    for (const { q, a } of riseQA(m)) expect(`${q} ${a}`).not.toMatch(/·|undefined|NaN/);
  });

  it("give the timetable in plain dates", () => {
    expect(when("2026-10-19", "2026-11-15")).toBe("19 Oct to 15 Nov 2026");
    expect(when("2026-11", "2026-12")).toBe("Nov to Dec 2026");
    expect(when("2027-03-01")).toBe("1 Mar 2027");
    expect(ct.timetable.find((t) => t.id === "council_budget")?.proposed).toBe(true);
  });
});
