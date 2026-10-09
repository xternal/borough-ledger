import { deleteByManageToken } from "@borough-ledger/server/follow";
import { EMAIL_ALERTS } from "@/lib/follow";
import { followContext, notFound } from "../context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

/**
 * One-click unsubscribe (RFC 8058). Mail clients POST `List-Unsubscribe=One-Click`
 * to the URL in the List-Unsubscribe header; we delete the subscription, the
 * address and everything followed.
 */
export async function POST(req: Request) {
  if (!EMAIL_ALERTS) return notFound();
  const token = new URL(req.url).searchParams.get("t");
  return (await deleteByManageToken(await followContext(), token))
    ? text("You are unsubscribed. We deleted your address and everything you followed.")
    : text("This link no longer works. You may have unsubscribed already.", 404);
}

/** Opening the link in a browser never unsubscribes (scanners prefetch links); it shows the manage page, which has the button. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  return new Response(null, {
    status: 303,
    headers: { location: new URL(`/follow/manage?t=${encodeURIComponent(token)}`, req.url).toString(), "cache-control": "no-store" },
  });
}
