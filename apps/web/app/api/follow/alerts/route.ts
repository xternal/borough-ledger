import { errorText } from "@borough-ledger/server";
import { runAlerts } from "@borough-ledger/server/follow";
import { alertItems, EMAIL_ALERTS } from "@/lib/follow";
import { sameSecret } from "@/lib/secret";
import { followContext, notFound } from "../context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The daily alerts job (vercel.json runs it at 07:00 UTC, 08:00 BST): emails
 * each confirmed follower the pledge changes published since the last run,
 * and deletes what the privacy rules say to delete. Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`; anything else gets 404, as does every
 * request while email is off.
 */
export async function GET(req: Request) {
  if (!EMAIL_ALERTS) return notFound();
  const ctx = await followContext();
  const secret = ctx.config.cronSecret;
  if (!secret || !sameSecret(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return notFound();
  try {
    const run = await runAlerts(ctx, alertItems());
    return Response.json({ ok: true, ...run }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("alerts failed:", errorText(e));
    return Response.json({ ok: false }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
