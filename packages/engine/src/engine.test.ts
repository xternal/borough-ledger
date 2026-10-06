import { describe, expect, it } from "vitest";
import { BANDS, DATA, type Lever, type Rules } from "@borough-ledger/schema";
import { REFERENCE_INPUT } from "./fixtures";
import {
  bandRatio,
  billFor,
  buildWaterfall,
  checkBudget,
  computeBalance,
  councilTaxYieldM,
  defaultScenario,
  displayYear,
  nextFinancialYear,
  perBandDHome,
  type BalanceInput,
  type Scenario,
} from "./index";

const { council: C, rules: R } = DATA;
const TOL = R.balanced_budget.tolerance_m;
const bandD = { council: C.bill.band_d_council, gla: C.bill.band_d_gla };

/** Live data, for checks on the data itself. */
const live: BalanceInput = {
  gapM: C.next_year.gap_m,
  levers: C.next_year.levers,
  toggles: C.next_year.toggles,
  reserves: { general_m: C.next_year.reserves.general.m, minimum_safe_m: C.next_year.reserves.minimum_safe.m },
  referendumThresholdPct: R.referendum_limit_pct[C.next_year.year]!.threshold_pct,
  toleranceM: TOL,
};
/** Frozen fixture, for the engine's arithmetic. */
const input = REFERENCE_INPUT;
const scenario = (levers: Scenario["levers"], toggles: Scenario["toggles"] = {}): Scenario => {
  const d = defaultScenario(input);
  return { levers: { ...d.levers, ...levers }, toggles: { ...d.toggles, ...toggles } };
};

describe("council rules (config, sourced)", () => {
  it("band ratios are the statutory 6:7:8:9:11:13:15:18 over 9", () => {
    const ninths = [6, 7, 8, 9, 11, 13, 15, 18];
    BANDS.forEach((b, i) => expect(R.band_ratios.value[b]).toEqual([ninths[i], 9]));
    expect(bandRatio(R, "D")).toBe(1);
    expect(bandRatio(R, "H")).toBe(2);
  });

  it("single person discount is 25%", () => {
    expect(R.single_person_discount.value).toBe(0.25);
    for (const b of BANDS) {
      const full = billFor(R, bandD, b, false);
      const alone = billFor(R, bandD, b, true);
      expect(alone.total).toBeCloseTo(full.total * 0.75, 10);
      expect(alone.council).toBeCloseTo(full.council * 0.75, 10);
    }
  });

  it("every rule cites a source", () => {
    for (const id of [R.band_ratios.source_id, R.single_person_discount.source_id, R.balanced_budget.source_id, R.balanced_budget.s114_source_id])
      expect(DATA.sources.get(id)?.url).toMatch(/^https:\/\/www\.legislation\.gov\.uk\//);
  });
});

describe("your bill", () => {
  it("Band D reproduces the published split: council £1,009.00 + Mayor of London £510.51 = £1,519.51", () => {
    const d = billFor(R, bandD, "D", false);
    expect(d.council).toBe(1009);
    expect(d.gla).toBe(510.51);
    expect(d.total).toBeCloseTo(C.bill.band_d_total, 10);
  });

  it("every band matches the government's published 2026/27 amount to the penny", () => {
    for (const b of BANDS) expect(Math.round(billFor(R, bandD, b, false).total * 100) / 100).toBe(C.bill.published_bands[b]);
  });

  it("council tax yield agrees with tax base × Band D × collection rate", () => {
    const y = councilTaxYieldM(C.tax_base.band_d_equivalents, C.bill.band_d_council, C.tax_base.collection_rate);
    const ct = C.funding.find((f) => f.id === "council_tax")!.m;
    expect(Math.abs(y - ct)).toBeLessThan(TOL);
  });
});

describe("the budget balances", () => {
  it("2026/27 funding, including reserves drawn, equals net spending", () => {
    const b = checkBudget(C.funding, C.services, TOL);
    expect(b.balances).toBe(true);
  });

  it("money the council funds itself equals spending after ring-fenced grants", () => {
    const general = C.funding.filter((f) => !f.ring_fenced_to).reduce((a, f) => a + f.m, 0);
    const spend = C.services.reduce((a, s) => a + s.general_fund_m, 0);
    expect(Math.abs(general - spend)).toBeLessThan(TOL);
  });

  it("an unbalanced year is detected, not hidden", () => {
    const b = checkBudget(C.funding, C.services.slice(1), TOL);
    expect(b.balances).toBe(false);
  });
});

describe("this year's gap", () => {
  it("2026/27 waterfall closes to zero", () => {
    const w = buildWaterfall(C.gap_2026_27, TOL);
    expect(w.closes).toBe(true);
    expect(w.residualM).toBeCloseTo(0, 9);
    expect(w.gapM).toBeCloseTo(17.2, 9); // budget report Table 2: lines opening the gap
  });

  it("a waterfall that does not close is reported", () => {
    const lines = C.gap_2026_27.filter((l) => l.kind !== "close_saving");
    expect(buildWaterfall(lines, TOL).closes).toBe(false);
  });
});

describe("balance it: five reference scenarios", () => {
  const cases: { name: string; s: Scenario; remainingM: number; status: string }[] = [
    { name: "1. defaults: 4.99% rise only", s: scenario({}), remainingM: 10.97307, status: "short" },
    { name: "2. rise, £6m savings, 5% fees, £3m reserves", s: scenario({ savings: 6, fees: 5, reserves: 3 }), remainingM: -0.02693, status: "spare" },
    { name: "3. council tax freeze, £15m savings", s: scenario({ ct_rise: 0, savings: 15 }), remainingM: 0, status: "balanced" },
    { name: "4. 6% rise and £15m reserves", s: scenario({ ct_rise: 6, reserves: 15 }), remainingM: -4.842, status: "spare" },
    {
      name: "5. 5% cut in settlement, services off, officers on",
      s: scenario({ settlement: -5 }, { free_home_care: false, weekly_bins: false, library_hours: false, extra_officers: true }),
      remainingM: 11.18807,
      status: "short",
    },
  ];
  it.each(cases)("$name", ({ s, remainingM, status }) => {
    const r = computeBalance(input, s);
    expect(r.remainingM).toBeCloseTo(remainingM, 9);
    expect(r.status).toBe(status);
  });

  it("every scenario keeps the identity: gap = closed + still to find", () => {
    for (const { s } of cases) {
      const r = computeBalance(input, s);
      expect(r.closedM + r.remainingM).toBeCloseTo(input.gapM, 9);
      expect(r.parts.reduce((a, p) => a + p.m, 0)).toBeCloseTo(r.closedM, 9);
    }
  });

  it("never rounds a small shortfall to balanced", () => {
    const r = computeBalance(input, scenario({ ct_rise: 0, savings: 14.99 }));
    expect(r.status).toBe("short");
    expect(r.flags.section114).toBe(true);
  });
});

describe("balance it: flags", () => {
  it("a council tax rise above 4.99% raises the referendum flag (the law: 5% or more)", () => {
    expect(R.referendum_limit_pct[C.meta.year]).toMatchObject({ threshold_pct: 5, core: 3, adult_social_care: 2, quality: "sourced" });
    expect(computeBalance(input, scenario({ ct_rise: 4.99 })).flags.referendum).toBe(false);
    expect(computeBalance(input, scenario({ ct_rise: 4.999 })).flags.referendum).toBe(false);
    expect(computeBalance(input, scenario({ ct_rise: 4.75 })).flags.referendum).toBe(false);
    expect(computeBalance(input, scenario({ ct_rise: 5 })).flags.referendum).toBe(true);
    expect(computeBalance(input, scenario({ ct_rise: 8 })).flags.referendum).toBe(true);
  });

  it("reserves are one-off and leave less in the bank", () => {
    const r = computeBalance(input, scenario({ reserves: 3 }));
    expect(r.flags.oneOffM).toBe(3);
    expect(r.reservesLeftM).toBe(input.reserves.general_m - 3);
    expect(computeBalance(input, scenario({})).flags.oneOffM).toBe(0);
  });

  it("flags reserves below the safe minimum", () => {
    const small = { ...input, reserves: { general_m: 20, minimum_safe_m: 15 } };
    expect(computeBalance(small, scenario({ reserves: 5 })).flags.belowSafeMinimum).toBe(false);
    expect(computeBalance(small, scenario({ reserves: 10 })).flags.belowSafeMinimum).toBe(true);
  });

  it("raises no referendum flag when government sets no limit (H&F, 2027/28)", () => {
    expect(live.referendumThresholdPct).toBeNull();
    expect(computeBalance(live, { levers: { ct_rise: 9.99 }, toggles: {} }).flags.referendum).toBe(false);
    expect(computeBalance({ ...input, referendumThresholdPct: null }, scenario({ ct_rise: 8 })).flags.referendum).toBe(false);
  });

  it("a lever with an assumed value closes only the difference from it", () => {
    const levers = input.levers.map((l) => (l.id === "ct_rise" ? { ...l, assumed: 4.99 } : l));
    const at = (v: number) => computeBalance({ ...input, levers }, scenario({ ct_rise: v })).parts.find((p) => p.id === "council_tax")!.m;
    expect(at(4.99)).toBeCloseTo(0, 12);
    expect(at(5.99)).toBeCloseTo(0.807, 9);
    expect(at(3.99)).toBeCloseTo(-0.807, 9);
  });

  it("opens on the council's own forecast gap for next year", () => {
    expect(C.next_year.gap_m).toBe(31.4);
    expect(C.next_year.quality).toBe("sourced");
    expect(computeBalance(live, defaultScenario(live)).remainingM).toBeCloseTo(31.4, 9);
  });

  it("does not read the referendum threshold from the lever", () => {
    const levers: Lever[] = input.levers.map((l) => ({ ...l, limit: 99 }));
    expect(computeBalance({ ...input, levers }, scenario({ ct_rise: 5 })).flags.referendum).toBe(true);
  });
});

describe("helpers", () => {
  it("costs a pledge per Band D home", () => {
    expect(perBandDHome(2.5, 82000)).toBeCloseTo(30.4878, 3);
    expect(perBandDHome(2.5, C.tax_base.band_d_equivalents)).toBeCloseTo(26.71, 2);
  });
  it("steps financial years", () => {
    expect(nextFinancialYear("2027-28")).toBe("2028-29");
    expect(nextFinancialYear("2099-00")).toBe("2100-01");
    expect(displayYear("2027-28")).toBe("2027/28");
    expect(() => displayYear("2027-29")).toThrow();
  });
  it("type-checks the rules shape", () => {
    const r: Rules = R;
    expect(Object.keys(r.referendum_limit_pct)).toContain(C.meta.year);
  });
});
