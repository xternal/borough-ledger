import { describe, expect, it } from "vitest";
import { isStatementPath, sectionForPath, sectionHref } from "@/lib/nav";

describe("where you are", () => {
  it("highlights the section a page belongs to", () => {
    expect(sectionForPath("/promises")).toBe("promises");
    expect(sectionForPath("/promise/lab-2026-parks")).toBe("promises");
    expect(sectionForPath("/councillor/stephen-cowan")).toBe("promises");
    expect(sectionForPath("/councillors")).toBe("promises");
    expect(sectionForPath("/payments")).toBe("payments");
    expect(sectionForPath("/payments/2026-06")).toBe("payments");
    expect(sectionForPath("/supplier/veolia-es-uk-ltd")).toBe("payments");
    expect(sectionForPath("/sources")).toBe("method");
    expect(sectionForPath("/promisesxyz")).toBeNull();
  });

  it("follows the section in view on the statement instead", () => {
    expect(isStatementPath("/")).toBe(true);
    expect(isStatementPath("/balance")).toBe(true);
    expect(isStatementPath("/payments")).toBe(false);
    expect(sectionHref("bill")).toBe("/#bill");
    expect(sectionHref("payments")).toBe("/payments");
  });
});

describe("promise filters", () => {
  it("name each side from the data and count it, the same way for every party", async () => {
    const { buildModel } = await import("@/lib/model");
    const { sides } = await import("@/lib/promises");
    const m = buildModel();
    const s = sides(m.promises);
    expect(s.map((x) => x.label)).toEqual(["Labour, runs the council", "Conservative, opposition"]);
    expect(s.reduce((a, x) => a + x.count, 0)).toBe(m.promises.length);
    // A different council with no overall control would read: everyone is opposition, still from the data.
    const hung = m.promises.map((p) => ({ ...p, side: "opposition" as const }));
    expect(sides(hung).map((x) => x.label)).toEqual(["Labour, Conservative, opposition"]);
  });
});
