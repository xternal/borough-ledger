import { describe, expect, it } from "vitest";
import { buildModel } from "@/lib/model";

describe("page model", () => {
  const m = buildModel();

  it("takes every headline number from data", () => {
    expect(m.netBudget.value).toBeCloseTo(224, 9);
    expect(m.savingsThisYear.value).toBeCloseTo(10, 9);
    expect(m.waterfall.gap.value).toBeCloseTo(20.7, 9);
    expect(m.balance.gap.value).toBe(15);
    expect(m.place.nextYearLabel).toBe("2027/28");
    expect(m.place.yearAfterLabel).toBe("2028/29");
    expect(m.payments.period).toBe("July to September 2026");
  });

  it("derived values inherit the worst quality of their inputs", () => {
    expect(m.bill.total.quality).toBe("approx");
    expect(m.ctShare.quality).toBe("test");
    expect(m.netBudget.quality).toBe("test");
    expect(m.referendumLimitNow.quality).toBe("approx");
  });

  it("costs promises the same way for both sides", () => {
    const opp = m.promises.find((p) => p.side === "opposition" && p.cost);
    const adm = m.promises.find((p) => p.side === "administration" && p.cost);
    for (const p of [opp, adm]) {
      expect(p?.cost?.perBandD.value).toBeCloseTo((p!.cost!.central.value * 1e6) / 82000, 6);
      expect(p?.cost?.share.value).toBeCloseTo(p!.cost!.central.value / 224, 9);
    }
  });

  it("reports when the build carries test data", () => {
    expect(m.hasTestData).toBe(true);
  });
});
