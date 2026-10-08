import type { MetadataRoute } from "next";
import { DATA } from "@borough-ledger/schema";
import { DECISIONS } from "@/lib/decisions";
import { buildModel } from "@/lib/model";
import { MONTHS, suppliersById } from "@/lib/payments";
import { dateModified } from "@/lib/promiseText";
import { SITE_URL } from "@/lib/site";
import { OTHER_BOROUGHS } from "@/lib/boroughList";
import { partiesOf, topicsOf } from "@/lib/topics";
import { WARD_MAP } from "@/lib/wards";

/** lastModified only where we know when a page's content last changed; search engines ignore a date they cannot trust. */
export default function sitemap(): MetadataRoute.Sitemap {
  const m = buildModel();
  const changed = new Map(m.promises.map((p) => [p.id, dateModified(p)]));
  const latest = (ds: string[]) => ds.filter(Boolean).sort().at(-1);
  const promisesChanged = latest([...changed.values()]);
  const decisionsChanged = latest([DECISIONS.decisions[0]?.date ?? "", ...DATA.content.decision_links.map((l) => l.suggested_on)]);
  const peopleChanged = latest([m.people.retrievedOn, WARD_MAP.source.retrieved_on]);
  return [
    { url: `${SITE_URL}/`, lastModified: DATA.council.meta.vintage, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/balance`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly", priority: 0.6 },
    ...OTHER_BOROUGHS.map((b) => ({ url: `${SITE_URL}${b.href}`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${SITE_URL}/building`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/council-homes`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/promises`, lastModified: promisesChanged, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/decisions`, lastModified: decisionsChanged, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/wards`, lastModified: peopleChanged, changeFrequency: "monthly", priority: 0.6 },
    ...DATA.content.wards.wards.map((w) => ({ url: `${SITE_URL}/ward/${w.id}`, lastModified: peopleChanged, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...partiesOf(m).map((pt) => ({ url: `${SITE_URL}/party/${pt.id}`, lastModified: pt.changed, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...topicsOf(m).map((t) => ({ url: `${SITE_URL}/topic/${t.slug}`, lastModified: t.changed, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...DATA.content.promises.map((p) => ({ url: `${SITE_URL}/promise/${p.id}`, lastModified: changed.get(p.id), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...DATA.content.councillors.map((c) => ({ url: `${SITE_URL}/councillor/${c.id}`, lastModified: m.people.retrievedOn, changeFrequency: "monthly" as const, priority: 0.4 })),
    { url: `${SITE_URL}/sources`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/follow`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/payments`, changeFrequency: "monthly", priority: 0.7 },
    ...MONTHS.map((mo) => ({ url: `${SITE_URL}/payments/${mo}`, changeFrequency: "yearly" as const, priority: 0.4 })),
    ...[...suppliersById().values()]
      .filter((s) => s.page)
      .map((s) => ({ url: `${SITE_URL}/supplier/${s.id}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
