import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { counterFromEnv, counts, countView } from "./lib/views";

/**
 * Next 16 proxy (formerly middleware), Node.js runtime. Its only job is the page count (lib/views.ts): a reader opening
 * one of the site's reading pages adds one to today's count for that path in Upstash Redis, after the page is on its
 * way. Only the path and the date are stored; crawlers, link previews, scripts, prefetches and every address that is
 * not one of the site's reading pages are skipped. A slow or failing counter never delays or breaks a page, and a
 * mistake here must not either: whatever happens, the page is served. Without the Upstash variables nothing counts.
 */

/** The page counter (production only: the Upstash variables are set there). */
const counter = counterFromEnv();

export function proxy(request: NextRequest, event: NextFetchEvent) {
  try {
    const path = request.nextUrl.pathname;
    if (counter && counts(request.method, path, request.headers)) event.waitUntil(countView(counter, path).catch(() => undefined));
  } catch {
    // Never let the count stand between a reader and the page.
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: not built assets, the API, or any file (an address with a dot: feeds, /views.json, icons, .md pages).
  // Next.js's own prefetches are skipped here too, so they cost nothing; lib/views.ts checks again.
  matcher: [
    {
      source: "/((?!_next/|api/|.*\\.).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
