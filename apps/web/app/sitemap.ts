import type { MetadataRoute } from "next";
import { DATA } from "@borough-ledger/schema";
import { MONTHS, suppliersById } from "@/lib/payments";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: DATA.council.meta.vintage, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/balance`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/promises`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/wards`, changeFrequency: "monthly", priority: 0.6 },
    ...DATA.content.wards.wards.map((w) => ({ url: `${SITE_URL}/ward/${w.id}`, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...DATA.content.promises.map((p) => ({ url: `${SITE_URL}/promise/${p.id}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...DATA.content.councillors.map((c) => ({ url: `${SITE_URL}/councillor/${c.id}`, changeFrequency: "monthly" as const, priority: 0.4 })),
    { url: `${SITE_URL}/sources`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/follow`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/payments`, changeFrequency: "monthly", priority: 0.7 },
    ...MONTHS.map((mo) => ({ url: `${SITE_URL}/payments/${mo}`, changeFrequency: "yearly" as const, priority: 0.4 })),
    ...[...suppliersById().values()]
      .filter((s) => s.page)
      .map((s) => ({ url: `${SITE_URL}/supplier/${s.id}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
