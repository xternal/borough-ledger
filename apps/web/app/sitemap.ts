import type { MetadataRoute } from "next";
import { DATA } from "@borough-ledger/schema";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: DATA.council.meta.vintage, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/balance`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/promises`, changeFrequency: "weekly", priority: 0.8 },
    ...DATA.content.promises.map((p) => ({ url: `${SITE_URL}/promise/${p.id}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...DATA.content.councillors.map((c) => ({ url: `${SITE_URL}/councillor/${c.id}`, changeFrequency: "monthly" as const, priority: 0.4 })),
  ];
}
