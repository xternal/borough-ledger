/** The top bar's sections, and which one a page belongs to, so people always see where they are. */
export const SECTIONS = [
  ["bill", "Your bill"],
  ["budget", "Budget"],
  ["gap", "The gap"],
  ["balance", "Balance it"],
  ["promises", "Promises"],
  ["ward", "Your ward"],
  ["payments", "Payments"],
  ["method", "Method"],
] as const;

export type SectionId = (typeof SECTIONS)[number][0];

/**
 * Every section has a page of its own (app/<path>/page.tsx). The home page is the long overview with every section on
 * it, so an old /#bill link still opens there; the menu and every link on the site go to the pages.
 */
const HREF: Record<SectionId, string> = {
  bill: "/bill",
  budget: "/budget",
  gap: "/gap",
  balance: "/balance",
  promises: "/promises",
  ward: "/wards",
  payments: "/payments",
  method: "/method",
};

export const sectionHref = (id: SectionId): string => HREF[id];

export const sectionLabel = (id: SectionId): string => SECTIONS.find(([s]) => s === id)![1];

/** The section after this one, in the order of the overview; null after the last. */
export function nextSection(id: SectionId): SectionId | null {
  const i = SECTIONS.findIndex(([s]) => s === id);
  return SECTIONS[i + 1]?.[0] ?? null;
}

/**
 * The section a page belongs to: its own page and the pages under it. Null on the home page, which is every section at
 * once, and on pages that belong to none (another council, the decoder).
 */
export function sectionForPath(path: string): SectionId | null {
  if (/^\/(bill|council-tax-rise)(\/|$)/.test(path)) return "bill";
  if (/^\/(budget|building|council-homes)(\/|$)/.test(path)) return "budget";
  if (/^\/gap(\/|$)/.test(path)) return "gap";
  if (/^\/balance(\/|$)/.test(path)) return "balance";
  if (/^\/(promises|promise|decisions|party|topic)(\/|$)/.test(path)) return "promises";
  if (/^\/(wards?|councillors?)(\/|$)/.test(path)) return "ward";
  if (/^\/(payments|supplier)(\/|$)/.test(path)) return "payments";
  if (/^\/(method|sources|follow|privacy|most-read)(\/|$)/.test(path)) return "method";
  return null;
}
