import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/site";

/**
 * AI search and assistant crawlers, named so a blanket rule elsewhere can never shut them out. The site is public
 * information meant to be quoted, with its sources; every page is open to them.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "DuckAssistBot",
  "MistralAI-User",
  "Meta-ExternalAgent",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/" }, ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/" }))],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
