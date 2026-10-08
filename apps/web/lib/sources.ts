/* Sources grouped for people: a short summary in "How this works", the full list on /sources. */
import type { Source } from "@borough-ledger/schema";

export interface SourceGroup {
  id: string;
  label: string;
  desc: string;
  items: Source[];
}

const GROUPS: { id: string; label: string; desc: string; test: (s: Source) => boolean }[] = [
  {
    id: "council",
    label: "Council budget papers",
    desc: "The budget, council tax and medium-term reports the council adopted.",
    test: (s) => s.publisher.startsWith("London Borough of Hammersmith") && !s.id.startsWith("spend_"),
  },
  {
    id: "government",
    label: "Government returns and statistics",
    desc: "Council tax tables and the budget and spending returns every council files with government.",
    test: (s) => /Ministry|Department|HM Treasury|Office for/.test(s.publisher),
  },
  { id: "law", label: "Laws and regulations", desc: "The rules a council's budget and council tax must follow.", test: (s) => s.publisher === "legislation.gov.uk" },
  { id: "spend", label: "The council's spend files", desc: "Every payment over £500, published by the council each quarter.", test: (s) => s.id.startsWith("spend_") },
  {
    id: "promises",
    label: "Manifestos and councillor records",
    desc: "Each party's 2026 manifesto, archived, and the council's own list of councillors.",
    test: (s) => s.id.startsWith("manifesto:") || s.id.startsWith("content:"),
  },
  { id: "method", label: "Our method", desc: "How figures are combined and modelled.", test: (s) => s.publisher === "Borough Book" },
];

/** Every source in exactly one group, in a fixed order; anything unmatched goes under "Other". */
export function groupSources(sources: readonly Source[]): SourceGroup[] {
  const left = new Set(sources);
  const out: SourceGroup[] = [];
  for (const g of GROUPS) {
    const items = sources.filter((s) => left.has(s) && g.test(s));
    items.forEach((s) => left.delete(s));
    if (items.length) out.push({ id: g.id, label: g.label, desc: g.desc, items });
  }
  if (left.size) out.push({ id: "other", label: "Other", desc: "", items: [...left] });
  return out;
}
