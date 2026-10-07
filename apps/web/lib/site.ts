import { ALLOW_TEST_DATA } from "./quality";

/** On Vercel, production links to the project's production address and a preview to its branch address. Build time, server code only. */
const VERCEL_URL =
  process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_ENV === "preview" && process.env.VERCEL_BRANCH_URL
      ? `https://${process.env.VERCEL_BRANCH_URL}`
      : undefined;

/** TODO(decide): production domain. Set NEXT_PUBLIC_SITE_URL on Vercel once the name is settled (PRE_SHIP_REVIEW, Decide). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? VERCEL_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Google Search Console's verification code (public by design: it sits in the page head). Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION on Vercel. */
export const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "";

/** The site is in alpha: shown next to the name and said in llms.txt. Remove when the pre-ship review is closed. */
export const STAGE = "Alpha";

/** Who made the site, credited in every footer. */
export const MAKER = { name: "Pavel Guzhikov", url: "https://guzh.uk", coffee: "https://ko-fi.com/pavelg" };

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
