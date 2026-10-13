import { counterFromEnv, readViews, VIEWS_CACHE_SECONDS, type ViewsFile } from "@/lib/views";

/**
 * /views.json: how many times each page was opened on each of the last 30 days (UTC), newest first. Public aggregates,
 * nothing about any reader (lib/views.ts); /most-read shows them, and the format is the same as LedgerGov.UK's and
 * RussiaLedger.com's. Cached for ten minutes. Before the counter is connected the list of days is empty, and a header says
 * why (the body keeps the shared format exactly); a counter that cannot be read answers 503.
 */
export const dynamic = "force-dynamic";

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "cache-control": `public, max-age=${VIEWS_CACHE_SECONDS}, s-maxage=${VIEWS_CACHE_SECONDS}`,
};
const UNAVAILABLE = 503;

export async function GET() {
  const counter = counterFromEnv();
  if (!counter) {
    const empty: ViewsFile = { generated_at: new Date().toISOString(), days: [] };
    return new Response(JSON.stringify(empty), { headers: { ...HEADERS, "x-views-counter": "not connected here, so nothing is counted" } });
  }
  try {
    return new Response(JSON.stringify(await readViews(counter)), { headers: HEADERS });
  } catch {
    return new Response(JSON.stringify({ error: "the counter cannot be read now" }), { status: UNAVAILABLE, headers: { ...HEADERS, "cache-control": "no-store" } });
  }
}
