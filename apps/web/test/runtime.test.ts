import { describe, expect, it, vi } from "vitest";

// On Vercel, pages rendered on request (such as /balance and its share image) cannot read data/build files from disk:
// only what the bundler imports ships with them. The page model must work from imported data alone.
vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  const guard = (p: unknown) => {
    if (/data\/(build\/payments|config)/.test(String(p))) throw new Error(`read from disk at request time: ${String(p)}`);
  };
  return {
    ...fs,
    readFileSync: ((p: Parameters<typeof fs.readFileSync>[0], ...rest: unknown[]) => {
      guard(p);
      return (fs.readFileSync as (...a: unknown[]) => unknown)(p, ...rest);
    }) as typeof fs.readFileSync,
  };
});

describe("pages rendered on request", () => {
  it("build the page model without reading payment files from disk", async () => {
    const { buildModel } = await import("@/lib/model");
    const m = buildModel();
    expect(m.payments.top.length).toBeGreaterThan(0);
    expect(m.payments.top[0]!.total.value).toBeGreaterThan(0);
  });

  it("name the pages on /most-read without reading files from disk", async () => {
    const { pageLabel } = await import("@/lib/mostRead");
    const { OTHER_BOROUGHS } = await import("@/lib/boroughList");
    const { DATA } = await import("@borough-ledger/schema");
    const ward = DATA.content.wards.wards[0]!;
    expect(pageLabel("/")).not.toBe("/");
    expect(pageLabel(`/ward/${ward.id}`)).toBe(`${ward.name} ward`);
    expect(pageLabel(`/${OTHER_BOROUGHS[0]!.slug}`)).toBe(OTHER_BOROUGHS[0]!.short);
    expect(pageLabel(`/promise/${DATA.content.promises[0]!.id}`)).toMatch(/pledge: \u201c/);
    expect(pageLabel(`/councillor/${DATA.content.councillors[0]!.id}`)).toMatch(/ ward$/);
    expect(pageLabel("/council-tax/camden")).toBe("Council tax in Camden");
    expect(pageLabel("/council-tax-rise/band-d")).toBe("Council tax next year: Band D");
    expect(pageLabel("/payments/2026-06")).toBe("Payments, June 2026");
    expect(pageLabel("/supplier/veolia-es-uk-ltd")).toBe("/supplier/veolia-es-uk-ltd");
    expect(pageLabel("/promise/gone")).toBe("/promise/gone");
  });
});
