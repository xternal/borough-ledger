import { describe, expect, it } from "vitest";
import { buildModel } from "@/lib/model";

describe("page model", () => {
  const m = buildModel();

  it("takes every headline number from data", () => {
    expect(m.netBudget.value).toBeCloseTo(398.009, 6);
    expect(m.generalBudget.value).toBeCloseTo(255.333, 6);
    expect(m.savingsThisYear.value).toBeCloseTo(9.5, 9);
    expect(m.waterfall.gap.value).toBeCloseTo(17.2, 9);
    expect(m.balance.gap.value).toBe(31.4);
    expect(m.place.nextYearLabel).toBe("2027/28");
    expect(m.place.yearAfterLabel).toBe("2028/29");
    expect(m.payments.period).toBe("July to September 2026");
  });

  it("derived values inherit the worst quality of their inputs", () => {
    expect(m.bill.total.quality).toBe("sourced");
    expect(m.netBudget.quality).toBe("sourced");
    expect(m.ctShare.quality).toBe("sourced");
    expect(m.savingsThisYear.quality).toBe("sourced");
    expect(m.balance.gap.quality).toBe("sourced");
    expect(m.balance.gap.value).toBe(31.4);
    expect(m.balance.ctAssumed?.value).toBe(4.99);
    expect(m.balance.referendumLimit).toBeNull();
    expect(m.balance.referendumNote?.text).toMatch(/Hammersmith and Fulham/);
    expect(m.referendumLimitNow.quality).toBe("sourced");
    expect(m.referendumLimitNow.value).toBe(5);
  });

  it("splits the budget by kind of funding, adding up to the whole", () => {
    expect(m.ctShare.value).toBeCloseTo(92.552 / 398.009, 6);
    expect(m.ctShareGeneral.value).toBeCloseTo(92.552 / 255.333, 6);
    expect(m.ctShare.value + m.grantsShare.value + m.ratesShare.value).toBeLessThan(1);
  });

  it("costs promises the same way for both sides", () => {
    const opp = m.promises.find((p) => p.side === "opposition" && p.cost);
    const adm = m.promises.find((p) => p.side === "administration" && p.cost);
    for (const p of [opp, adm]) {
      expect(p?.cost?.perBandD.value).toBeCloseTo((p!.cost!.central.value * 1e6) / 93597.96, 6);
      expect(p?.cost?.share.value).toBeCloseTo(p!.cost!.central.value / 255.333, 6);
    }
  });

  it("lists the savings with their totals and the one-off part", () => {
    expect(m.savings.serviceTotal?.value).toBeCloseTo(9.524, 9);
    expect(m.savings.collectionTotal?.value).toBeCloseTo(8.375, 9);
    expect(m.savings.oneOffTotal?.value).toBeCloseTo(5.75, 9);
  });

  it("reports when the build carries test data", () => {
    expect(m.hasTestData).toBe(true);
  });
});
