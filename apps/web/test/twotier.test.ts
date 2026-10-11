import { describe, expect, it } from "vitest";
import { boroughModel } from "@/lib/boroughs";
import { OTHER_BOROUGHS } from "@/lib/boroughList";
import { adultCare } from "@/lib/adultCare";
import { childrenCare } from "@/lib/childrenCare";
import config from "../next.config";

describe("a two-tier area: South Oxfordshire and Henley-on-Thames", () => {
  const m = boroughModel("south-oxfordshire")!;

  it("shows the county council's budget, balanced, with its share of the bill", () => {
    expect(m.county).toMatchObject({ council: "Oxfordshire County Council", ons: "E10000025" });
    expect(m.county!.bandD.value).toBe(2006.78);
    const B = m.county!.budget;
    const spend = B.services.reduce((a, s) => a + s.f.value, 0);
    expect(Math.abs(spend - B.netBudget.value)).toBeLessThan(0.05);
    expect(B.services.map((s) => s.id)).toContain("fire");
    // The district's own bill: the council keeps the smallest part of it.
    expect(m.bill.council.value).toBe(156.24);
    expect(m.bill.total.value).toBe(2461.3);
  });

  it("splits Henley-on-Thames's bill four ways, adding up to the whole, as the owner reviewed it", () => {
    const [t] = m.towns;
    expect(t!.id).toBe("henley-on-thames");
    expect(t!.parts.map((p) => [p.label, p.f.value])).toEqual([
      ["Oxfordshire County Council", 2006.78],
      ["Police", 298.28],
      ["Henley Town Council", 170.35],
      ["South Oxfordshire District Council", 156.24],
    ]);
    expect(t!.parts.reduce((a, p) => a + p.f.value, 0)).toBeCloseTo(t!.whole.value, 2);
    expect(t!.whole.value).toBe(2631.65);
    expect(t!.ward?.councillors.map((c) => c.name)).toEqual(["Ken Arlett", "Stefan Gawrysiak", "Kellie Hinton"]);
    expect(t!.divisions).toHaveLength(2);
    expect([t!.quality, t!.townPart.quality]).toEqual(["sourced", "sourced"]);
  });

  it("uses the county's figures for care, which the county runs", () => {
    expect(adultCare("E10000025")?.name).toBe("Oxfordshire");
    expect(childrenCare("E10000025")).not.toBeNull();
    expect(adultCare("E07000179")).toBeNull(); // the district runs no social care
    expect(m.sources.map((s) => s.title).some((t) => /adult social care/i.test(t))).toBe(true);
  });

  it("says the councils are being reorganised, with its sources", () => {
    expect(m.reorganisation?.note).toMatch(/Ridgeway Council/);
    expect(m.reorganisation?.sources.length).toBe(2);
  });

  it("lists the district apart from cities and towns, and sends /henley-on-thames to its section", async () => {
    expect(OTHER_BOROUGHS.find((b) => b.slug === "south-oxfordshire")).toMatchObject({ group: "Counties and regions", label: "District" });
    const redirects = await config.redirects!();
    expect(redirects).toContainEqual(expect.objectContaining({ source: "/henley-on-thames", destination: "/south-oxfordshire#henley-on-thames" }));
  });
});
