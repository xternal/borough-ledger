import type { Quality } from "@borough-ledger/schema";

/**
 * Test data may render only in development and in preview builds that opt in.
 * `build:prod` sets the flag to 0, so any test value rendered while prerendering throws and fails the build.
 */
export const ALLOW_TEST_DATA =
  process.env.NEXT_PUBLIC_BL_ALLOW_TEST_DATA === "1" ||
  (process.env.NEXT_PUBLIC_BL_ALLOW_TEST_DATA === undefined && process.env.NODE_ENV !== "production");

export class TestDataInProductionError extends Error {
  constructor(what: string) {
    super(
      `Test value rendered in a production build: ${what}. ` +
        "Replace it with sourced or approx data, or build with build:preview. " +
        "Full list: pnpm --filter @borough-ledger/schema report:test-values",
    );
    this.name = "TestDataInProductionError";
  }
}

export function assertRenderable(quality: Quality, what: string): void {
  if (quality === "test" && !ALLOW_TEST_DATA) throw new TestDataInProductionError(what);
}

export const QUALITY_LABEL: Record<Quality, string> = {
  sourced: "sourced",
  approx: "approx",
  modelled: "modelled",
  test: "test",
};

export const QUALITY_TITLE: Record<Quality, string> = {
  sourced: "Sourced from a published document",
  approx: "Approximate: from a secondary source or an assumption still to be checked",
  modelled: "Modelled from sourced inputs",
  test: "Test value, invented to show the layout. Do not quote.",
};
