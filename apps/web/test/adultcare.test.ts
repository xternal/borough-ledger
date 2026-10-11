import { describe, expect, it } from "vitest";
import { adultCare } from "@/lib/adultCare";

describe("what care for adults costs", () => {
  it("gives the government's own costs and where the money went, adding up to the total", () => {
    const hf = adultCare("E09000013")!;
    expect(hf.yearLabel).toBe("2024/25");
    expect(hf.units.map((u) => [u.id, u.f.value])).toEqual([
      ["residential_65", 1123.84],
      ["nursing_65", 1094.18],
      ["residential_18_64", 1393.31],
      ["home_care_hour", 20.03],
    ]);
    const sum = hf.parts.reduce((a, p) => a + p.f.value, 0);
    expect(Math.abs(sum - hf.total.value)).toBeLessThan(0.002);
    expect(hf.parts[0]!.label).toBe("Care homes and nursing homes");
    expect(hf.units.every((u) => u.f.quality === "sourced" && u.f.sources.includes("asc_finance_2024-25"))).toBe(true);
  });

  it("covers England only", () => {
    expect(adultCare("E06000030")).not.toBeNull(); // Swindon
    expect(adultCare("S12000049")).toBeNull(); // Glasgow
  });
});

describe("what people who get care say", () => {
  it("gives Hammersmith & Fulham's answers with their margins, beside London and England, without ranking", async () => {
    const { careResults, versus, versusText } = await import("@/lib/adultCare");
    const r = careResults("E09000013")!;
    expect(r.yearLabel).toBe("2024/25");
    expect(r.items.map((i) => [i.id, Math.round(i.f.value * 1000) / 10, i.moe, i.london?.vs, i.england.vs])).toEqual([
      ["satisfied", 55.3, 4.8, "lower", "lower"],
      ["in_control", 67.5, 4.5, "about the same", "lower"],
      ["feel_safe", 56, 4.7, "lower", "lower"],
    ]);
    expect(versusText(r.items[1]!)).toBe("about the same as London, lower than England");
    // A gap inside the two margins together is "about the same", whichever way it points.
    expect(versus({ pct: 60, moe: 5 }, { pct: 65, moe: 0.5 })).toBe("about the same");
    expect(versus({ pct: 72, moe: 2 }, { pct: 65, moe: 0.5 })).toBe("higher");
  });

  it("compares a council outside London with England only (Oxfordshire, for South Oxfordshire)", async () => {
    const { careResults } = await import("@/lib/adultCare");
    const r = careResults("E10000025")!;
    expect(r.items.every((i) => i.london === null)).toBe(true);
    expect(careResults("S12000049")).toBeNull(); // Glasgow: England's survey only
  });
});
