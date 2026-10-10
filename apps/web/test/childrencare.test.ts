import { describe, expect, it } from "vitest";
import { childrenCare } from "@/lib/childrenCare";

describe("what care for children costs", () => {
  it("gives spending, the children and where they live, and England's cost as our own sum", () => {
    const hf = childrenCare("E09000013")!;
    expect(hf.total?.value).toBeCloseTo(24.948139, 6);
    expect(hf.children.value).toBe(197);
    expect(hf.placements.map((p) => [p.id, p.f.value])).toEqual([
      ["foster", 140],
      ["supported_accommodation", 29],
      ["childrens_homes", 21],
    ]);
    expect(hf.someWithheld).toBe(true);
    expect(hf.englandHomeYear.quality).toBe("modelled");
    const sum = hf.parts.reduce((a, p) => a + p.f.value, 0);
    expect(Math.abs(sum - hf.total!.value)).toBeLessThan(0.00002);
  });

  it("says where the Department withheld a council's spending", () => {
    const w = childrenCare("E09000032")!; // Wandsworth
    expect(w.total).toBeNull();
    expect(w.parts).toEqual([]);
    expect(w.children.value).toBeGreaterThan(0);
  });
});
