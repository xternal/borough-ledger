import "server-only";
import { DATA } from "@borough-ledger/schema";
import { OTHER_BOROUGHS } from "./boroughList";
import { decodedCouncil } from "./decoder";
import { formatMonth } from "./format";
import { buildModel } from "./model";
import { shorten } from "./rss";
import { partiesOf, topicsOf } from "./topics";
import { counterFromEnv, readViews, type ViewsFile } from "./views";

/**
 * /most-read: the counter's totals (lib/views.ts) and a readable name for each page counted. The page is made again
 * on request every ten minutes, so every name comes from data bundled with the site, never from a file read from disk
 * (which is missing on Vercel at request time). A page that no longer exists, or a supplier (their names live in a
 * file too large to bundle), is shown by its address.
 */

export type ViewsState = { kind: "ready"; file: ViewsFile } | { kind: "not_connected" } | { kind: "unavailable" };

/** The last 30 days' totals, or why there are none: the counter is not connected here, or cannot be read now. */
export async function getViews(): Promise<ViewsState> {
  const counter = counterFromEnv();
  if (!counter) return { kind: "not_connected" };
  try {
    return { kind: "ready", file: await readViews(counter) };
  } catch {
    return { kind: "unavailable" };
  }
}

export const MOST_READ_TITLE = "Most read pages";

const FIXED: Record<string, string> = {
  "/": `${DATA.council.meta.council_short}: your bill, the budget and the gap`,
  "/bill": "Your council tax bill",
  "/budget": "The council's budget",
  "/gap": "How this year's gap opened and closed",
  "/balance": "Balance next year's budget",
  "/method": "How this works",
  "/council-tax-rise": "Council tax next year",
  "/council-tax": "Council tax decoder: every council in England",
  "/building": "What the council is building",
  "/council-homes": "Council homes",
  "/promises": "Promises",
  "/decisions": "Council decisions",
  "/wards": "Your ward: wards and councillors",
  "/privacy": "Privacy",
  "/sources": "Sources",
  "/follow": "Follow changes",
  "/payments": "Payments over £500",
  "/most-read": MOST_READ_TITLE,
};

/** A page's name as a reader would know it: the pledge, the ward, the councillor, the council, the month. */
export function pageLabel(path: string): string {
  if (FIXED[path]) return FIXED[path]!;
  const [, first, second] = path.split("/");
  if (!first) return path;
  const borough = OTHER_BOROUGHS.find((b) => b.slug === first);
  if (borough && !second) return borough.short;
  if (!second) return path;
  const m = buildModel();
  switch (first) {
    case "promise": {
      const p = m.promises.find((x) => x.id === second);
      return p ? `${p.partyShort} pledge: “${shorten(p.text, 80)}”` : path;
    }
    case "ward": {
      const w = DATA.content.wards.wards.find((x) => x.id === second);
      return w ? `${w.name} ward` : path;
    }
    case "councillor": {
      const c = m.people.councillors.find((x) => x.id === second);
      return c ? `${c.name}, ${c.ward} ward` : path;
    }
    case "party": {
      const pt = partiesOf(m).find((x) => x.id === second);
      return pt ? `${pt.name}: 2026 manifesto pledges` : path;
    }
    case "topic": {
      const t = topicsOf(m).find((x) => x.slug === second);
      return t ? `${t.area}: pledges from every party` : path;
    }
    case "council-tax": {
      const c = decodedCouncil(second);
      return c ? `Council tax in ${c.place}` : path;
    }
    case "council-tax-rise":
      return /^band-[a-z]$/.test(second) ? `Council tax next year: Band ${second.slice(5).toUpperCase()}` : path;
    case "payments":
      return /^\d{4}-\d{2}$/.test(second) ? `Payments, ${formatMonth(second)}` : path;
    default:
      return path;
  }
}
