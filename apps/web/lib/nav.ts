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

/** Sections with a page of their own; the rest are parts of the home page. */
export function sectionHref(id: SectionId): string {
  if (id === "ward") return "/wards";
  return id === "promises" || id === "payments" ? `/${id}` : `/#${id}`;
}

/** The section a page belongs to, or null on the long pages where the section in view is highlighted instead. */
export function sectionForPath(path: string): SectionId | null {
  if (/^\/(promises|promise|decisions|party|topic)(\/|$)/.test(path)) return "promises";
  if (/^\/(wards?|councillors?)(\/|$)/.test(path)) return "ward";
  if (/^\/(payments|supplier)(\/|$)/.test(path)) return "payments";
  if (/^\/(sources|follow|privacy)(\/|$)/.test(path)) return "method";
  if (/^\/(building|council-homes)(\/|$)/.test(path)) return "budget";
  return null;
}

/** Pages that are the long statement, where the menu follows the section in view. */
export const isStatementPath = (path: string) => path === "/" || path === "/balance";
