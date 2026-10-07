import { describe, expect, it, vi } from "vitest";

// On Vercel, pages rendered on request (such as /balance and its share image) cannot read data/build files from disk:
// only what the bundler imports ships with them. The page model must work from imported data alone.
vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  const guard = (p: unknown) => {
    if (String(p).includes("data/build/payments")) throw new Error(`read from disk at request time: ${String(p)}`);
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
});
