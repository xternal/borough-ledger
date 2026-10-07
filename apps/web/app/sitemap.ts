import type { MetadataRoute } from "next";
import { DATA } from "@borough-ledger/schema";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: DATA.council.meta.vintage, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/balance`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly", priority: 0.6 },
  ];
}
