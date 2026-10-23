/**
 * The site's sections, in the order of the overview (the home page after its first screen): each has a page of its own,
 * and a page belongs to one of them, so people always see where they are. The menu (MENU) shows five of them; the
 * rest are parts of Budget (BUDGET_PARTS).
 */
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

/**
 * The menu: five pages, Method last (Pavel, 23 Oct 2026, as on LedgerGov.UK; docs/PRE_SHIP_REVIEW.md, "A short menu
 * and a first screen of cards"). The gap, Balance it and Payments are parts of Budget: on their pages Budget is
 * highlighted, and the Budget tabs (BudgetTabs) say which part you are on.
 */
export const MENU: readonly SectionId[] = ["bill", "budget", "promises", "ward", "method"];

/** Budget's parts, in the order of its tabs: the budget itself, how this year's gap was closed, next year, every payment. */
export const BUDGET_PARTS: readonly SectionId[] = ["budget", "gap", "balance", "payments"];

/** The menu item a section is under: the section itself, or Budget for its parts. */
export const menuItemFor = (id: SectionId | null): SectionId | null => (id && BUDGET_PARTS.includes(id) ? "budget" : id);

/**
 * Promises are in every menu (decision 30). On another council's page, or the council tax decoder, the item leads to
 * the promises this site tracks, which are Hammersmith & Fulham's, so a screen reader hears whose they are.
 */
export const PROMISES_ITEM = { id: "promises", label: "Promises", href: HREF.promises, whose: "in Hammersmith & Fulham" } as const;

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
