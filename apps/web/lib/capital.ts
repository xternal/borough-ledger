/* The four-year building programme and the council homes account, for /building and /council-homes. Every figure
   carries the quality of the hand-made table it comes from: approx until a person has checked every line. */
import { DATA, type CapitalLine, type CapitalSection, type Figure } from "@borough-ledger/schema";
import type { PageModel, PromiseModel } from "./model";

export const CAPITAL = DATA.capital.programme;
export const HOMES = DATA.capital.council_homes;
export const capFig = (value: number): Figure => ({ value, quality: CAPITAL.quality, sources: [CAPITAL.source_id] });
export const homesFig = (value: number): Figure => ({ value, quality: HOMES.quality, sources: [HOMES.source_id] });
export const fact = (key: string): Figure => homesFig(HOMES.facts[key]!.value);

/** "2026-27" as people write it. */
export const yearLabel = (y: string) => y.replace("-", "/");
export const YEARS = CAPITAL.years.map(yearLabel);
export const SPAN = `${YEARS[0]} to ${YEARS[YEARS.length - 1]}`;

export type Account = "gf" | "hra";
export const sectionsOf = (account: Account): CapitalSection[] => CAPITAL.sections.filter((s) => s.account === account);
export const totalOf = (account: Account) => CAPITAL.summary[account];

/** A group's four-year total: its printed subtotal, or its lines when the report prints none. */
export function groupTotal(g: CapitalSection["groups"][number]): number {
  return g.subtotal?.total ?? g.lines.reduce((a, l) => a + (l.total ?? 0), 0);
}

/** Every group of an account, largest first. */
export function groupsOf(account: Account) {
  return sectionsOf(account)
    .flatMap((s) => s.groups.map((g) => ({ ...g, section: s.id, total: groupTotal(g), lines: g.lines.filter((l) => l.total) })))
    .sort((a, z) => z.total - a.total);
}

/** How the programme is paid for, in residents' words; the council's term is the key. */
export const FUNDING: Record<string, { plain: string; desc: string }> = {
  Grants: { plain: "Grants", desc: "From government, the Mayor of London and others, for named schemes." },
  "Section 106 / Community Infrastructure Levy (CIL)": {
    plain: "Payments from developers",
    desc: "Section 106 agreements and the Community Infrastructure Levy: money developers pay when they build in the borough.",
  },
  "Capital Receipts": { plain: "Selling land, buildings and homes", desc: "Money from selling council property, including council homes bought by their tenants under Right to Buy." },
  "Major Repairs Reserve": { plain: "Set aside from rents for major repairs", desc: "Council homes only." },
  "Revenue Contributions and Other Reserves": { plain: "From yearly budgets and reserves", desc: "Money from the council's day-to-day budgets and its reserves." },
  Borrowing: { plain: "Borrowing", desc: "Repaid with interest over many years: from the yearly budget, or for council homes from rents." },
};

/** Funding of an account across its sections, by source, in the report's order. */
export function fundingOf(account: Account) {
  const out = new Map<string, number[]>();
  for (const s of sectionsOf(account))
    for (const f of s.funding) {
      const cur = out.get(f.label) ?? [0, 0, 0, 0, 0];
      f.years.forEach((v, i) => (cur[i]! += v));
      cur[4]! += f.total ?? 0;
      out.set(f.label, cur);
    }
  return [...out].map(([label, v]) => ({ label, ...(FUNDING[label] ?? { plain: label, desc: "" }), years: v.slice(0, 4), total: v[4]! })).filter((f) => Math.abs(f.total) > 0.04);
}

/** Lines of an account that pay towards a pledge, with the pledge cards. */
export function pledgeLinks(account: Account, m: PageModel): { line: CapitalLine; promises: PromiseModel[] }[] {
  const byId = new Map(m.promises.map((p) => [p.id, p]));
  return sectionsOf(account)
    .flatMap((s) => s.groups.flatMap((g) => g.lines))
    .filter((l) => l.pledges?.length && l.total)
    .map((line) => ({ line, promises: line.pledges!.map((id) => byId.get(id)).filter((p): p is PromiseModel => !!p) }));
}

export const SOURCE = DATA.sources.get(CAPITAL.source_id)!;
export const HOMES_SOURCE = DATA.sources.get(HOMES.source_id)!;
export const RESOLUTION = DATA.decisions.decisions.find((d) => d.id === CAPITAL.resolution.decision_id)!;
