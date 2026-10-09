import { confirmEmailFollow } from "@borough-ledger/server/follow";
import { EMAIL_ALERTS } from "@/lib/follow";
import { followContext, notFound } from "../context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function tokenFrom(req: Request): Promise<string | null> {
  try {
    const t = (await req.formData()).get("t");
    return typeof t === "string" ? t : null;
  } catch {
    return null;
  }
}

/**
 * The confirmation page's button posts here (a plain HTML form, so it works
 * without JavaScript). There is no GET: mail scanners open links, and opening
 * a link must never confirm anything.
 */
export async function POST(req: Request) {
  if (!EMAIL_ALERTS) return notFound();
  const res = await confirmEmailFollow(await followContext(), await tokenFrom(req));
  const done = res.ok && res.kind === "addition" ? "added" : "confirmed";
  const to = res.ok ? `/follow/manage?t=${encodeURIComponent(res.manageToken)}&m=${done}` : `/follow/confirm?e=${res.reason}`;
  return new Response(null, { status: 303, headers: { location: new URL(to, req.url).toString(), "cache-control": "no-store" } });
}
