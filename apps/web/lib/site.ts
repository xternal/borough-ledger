import { ALLOW_TEST_DATA } from "./quality";

/** A Vercel preview (such as the Alpha) links to its own branch address; set at build time, used by server code only. */
const PREVIEW_URL = process.env.VERCEL_ENV === "preview" && process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : undefined;

/** TODO(decide): production domain. Set NEXT_PUBLIC_SITE_URL on Vercel once the name is settled (PRE_SHIP_REVIEW, Decide). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? PREVIEW_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const SITE = {
  name: "Borough Ledger",
  title: "Borough Ledger: where your council tax goes in Hammersmith & Fulham",
  description:
    "An independent, plain-English account of Hammersmith & Fulham Council's money and promises: your council tax bill by band, the budget, how this year's gap was closed, a tool to balance next year, and payments over £500. Not run by the council.",
};

/**
 * Builds that may contain test data are kept out of search engines and AI crawlers,
 * so invented figures are never indexed or quoted. A production build cannot contain
 * test data, so it is indexable.
 */
export const INDEXABLE = !ALLOW_TEST_DATA;
