import { describe, expect, it } from "vitest";
import hfRaw from "../../../data/seed/hf_2026-27.json";
import promisesRaw from "../../../data/seed/promises.json";
import paymentsRaw from "../../../data/seed/payments.json";
import rulesRaw from "../../../data/config/rules.json";
import { DATA, parseDataset } from "./data";
import { derive, fig, worst } from "./quality";
import { listTestValues } from "./testValues";

const raw = () => structuredClone({ council: hfRaw, promises: promisesRaw, payments: paymentsRaw, rules: rulesRaw });

describe("seed parses and cross-checks", () => {
  it("loads the committed seed", () => {
    expect(DATA.council.meta.year).toBe("2026-27");
    expect(DATA.sources.get("prototype_test")?.url).toBeUndefined();
  });

  it("rejects a value without a quality", () => {
    const r = raw();
    delete (r.council.funding[0] as { quality?: string }).quality;
    expect(() => parseDataset(r)).toThrow();
  });

  it("rejects an unknown source id", () => {
    const r = raw();
    r.council.services[0]!.source_id = "nope";
    expect(() => parseDataset(r)).toThrow(/unknown source_id "nope"/);
  });

  it("rejects a sourced value that cites a source without a URL", () => {
    const r = raw();
    r.council.services[0]!.quality = "sourced";
    expect(() => parseDataset(r)).toThrow(/has no URL/);
  });

  it("rejects a real promise card without a source", () => {
    const r = raw();
    r.promises.promises[0]!.sources = [];
    expect(() => parseDataset(r)).toThrow(/needs at least one source/);
  });

  it("rejects a promise linked to a toggle that does not exist", () => {
    const r = raw();
    r.promises.promises[0]!.lever_or_toggle_id = "nope";
    expect(() => parseDataset(r)).toThrow(/unknown lever or toggle/);
  });

  it("keeps the prototype's copies of the rules in step with the rules config", () => {
    for (const [band, [num, den]] of Object.entries(DATA.rules.band_ratios.value))
      expect(DATA.council.bill.band_ratios[band as keyof typeof DATA.council.bill.band_ratios]).toBeCloseTo(num / den, 12);
    const ct = DATA.council.next_year.levers.find((l) => l.id === "ct_rise");
    expect(ct?.limit).toBe(DATA.rules.referendum_limit_pct[DATA.council.next_year.year]?.value);
  });

  it("decides administration or opposition from data, never from a party name", () => {
    expect(new Set(DATA.promises.promises.map((p) => p.side))).toEqual(new Set(["administration", "opposition"]));
  });
});

describe("quality", () => {
  it("derived values take the worst input quality", () => {
    expect(worst("sourced", "approx")).toBe("approx");
    expect(worst("approx", "test", "sourced")).toBe("test");
    const d = derive(3, fig(1, "sourced", "a"), fig(2, "test", "b"));
    expect(d).toEqual({ value: 3, quality: "test", sources: ["a", "b"] });
  });

  it("lists every test value in the seed", () => {
    const list = listTestValues(DATA);
    expect(list).toContain("funding.business_rates");
    expect(list).toContain("promises.test-b-slogan (test card)");
    expect(list).not.toContain("funding.transition");
  });
});
