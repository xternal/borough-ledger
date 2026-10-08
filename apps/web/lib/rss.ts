/* RSS 2.0 feeds, built with the site: no tracking, no accounts, nothing stored about who follows (docs/PRIVACY.md). */
import { SITE, SITE_URL } from "./site";

export interface FeedItem {
  title: string;
  /** Path on the site, such as /promise/lab-2026-parks. */
  path: string;
  /** Stable for ever, even if the domain changes: a tag URI. */
  guid: string;
  /** YYYY-MM-DD. */
  date: string;
  description: string;
}

export interface Feed {
  title: string;
  description: string;
  /** The page the feed follows. */
  path: string;
  /** The feed's own path, such as /promise/lab-2026-parks/feed.xml. */
  self: string;
  items: FeedItem[];
}

/** At most this many items, newest first. */
export const FEED_LIMIT = 100;

export const tag = (...parts: (string | number)[]) => `tag:borough-ledger,2026:${parts.join("/")}`;

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

/** RFC 822, as RSS asks: midday UTC, so the day is the same in every UK time zone. */
export function rfc822(date: string): string {
  return new Date(`${date}T12:00:00Z`).toUTCString();
}

export const shorten = (s: string, n = 90) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/** Newest first, ties broken by title so the order never wobbles between builds. */
export function sortItems(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, z) => z.date.localeCompare(a.date) || a.title.localeCompare(z.title)).slice(0, FEED_LIMIT);
}

export function renderFeed(f: Feed): string {
  const items = sortItems(f.items);
  const built = items[0]?.date;
  const body = items
    .map(
      (i) => `    <item>
      <title>${escapeXml(i.title)}</title>
      <link>${escapeXml(`${SITE_URL}${i.path}`)}</link>
      <guid isPermaLink="false">${escapeXml(i.guid)}</guid>
      <pubDate>${rfc822(i.date)}</pubDate>
      <description>${escapeXml(i.description)}</description>
    </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(f.title)}</title>
    <link>${escapeXml(`${SITE_URL}${f.path}`)}</link>
    <atom:link href="${escapeXml(`${SITE_URL}${f.self}`)}" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(f.description)}</description>
    <language>en-gb</language>
    <generator>${escapeXml(SITE.name)}</generator>
${built ? `    <lastBuildDate>${rfc822(built)}</lastBuildDate>\n` : ""}${body}
  </channel>
</rss>
`;
}

export function feedResponse(f: Feed): Response {
  return new Response(renderFeed(f), { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}

/** For <head>: lets browsers and feed readers find a page's feed. */
export const feedAlternate = (self: string, title: string) => ({ "application/rss+xml": [{ url: self, title }] });
