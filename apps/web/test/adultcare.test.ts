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
