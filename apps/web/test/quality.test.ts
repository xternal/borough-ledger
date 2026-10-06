import { afterEach, describe, expect, it, vi } from "vitest";

async function guardWith(flag: string | undefined, nodeEnv: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  if (flag === undefined) vi.stubEnv("NEXT_PUBLIC_BL_ALLOW_TEST_DATA", undefined as unknown as string);
  else vi.stubEnv("NEXT_PUBLIC_BL_ALLOW_TEST_DATA", flag);
  return import("@/lib/quality");
}

afterEach(() => vi.unstubAllEnvs());

describe("test data guard", () => {
  it("blocks test values in a production build", async () => {
    const q = await guardWith("0", "production");
    expect(q.ALLOW_TEST_DATA).toBe(false);
    expect(() => q.assertRenderable("test", "x")).toThrow(q.TestDataInProductionError);
    expect(() => q.assertRenderable("approx", "x")).not.toThrow();
    expect(() => q.assertRenderable("sourced", "x")).not.toThrow();
  });
  it("blocks test values in production when the flag is unset", async () => {
    const q = await guardWith(undefined, "production");
    expect(() => q.assertRenderable("test", "x")).toThrow();
  });
  it("allows marked test values in preview builds and development", async () => {
    expect((await guardWith("1", "production")).ALLOW_TEST_DATA).toBe(true);
    expect((await guardWith(undefined, "development")).ALLOW_TEST_DATA).toBe(true);
  });
  it("keeps preview builds out of search engines", async () => {
    await guardWith("1", "production");
    const site = await import("@/lib/site");
    expect(site.INDEXABLE).toBe(false);
  });
});
