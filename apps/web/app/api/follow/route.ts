import { clientKeyFrom, errorText, rateLimit, verifySpamCheck } from "@borough-ledger/server";
import { CONFIRM_TTL_DAYS, parseFollowRequest, requestEmailFollow } from "@borough-ledger/server/follow";
import { EMAIL_ALERTS, isKnownTarget } from "@/lib/follow";
import { followContext, notFound } from "./context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Follow requests per client (salted, IP-free) per day. Generous enough for a shared connection. */
const DAILY_LIMIT = 10;
const MAX_BODY = 16_000;

const FIELD_MESSAGE: Record<string, string> = {
  email: "Enter an email address, like name@example.com.",
  targets: "We could not find that pledge. Reload the page and try again.",
  altcha: "The spam check did not finish. Wait a moment and try again.",
  body: "Something went wrong. Reload the page and try again.",
};

function fail(status: number, error: string, message: string, field?: string) {
  return Response.json({ ok: false, error, field, message }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * POST /api/follow { email, targets: [{ kind, id }], altcha }.
 * The answer is the same whether or not the address is already subscribed.
 * Never logs the body.
 */
export async function POST(req: Request) {
  if (!EMAIL_ALERTS) return notFound();
  const raw = await req.text();
  if (raw.length > MAX_BODY) return fail(413, "too_large", FIELD_MESSAGE.body!);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "invalid", FIELD_MESSAGE.body!, "body");
  }
  const parsed = parseFollowRequest(body);
  if (!parsed.ok) return fail(400, "invalid", FIELD_MESSAGE[parsed.field]!, parsed.field);
  if (!parsed.value.targets.every(isKnownTarget)) return fail(400, "invalid", FIELD_MESSAGE.targets!, "targets");

  const ctx = await followContext();
  if (!(await verifySpamCheck(ctx.db, ctx.config, parsed.value.altcha))) return fail(400, "spam_check", FIELD_MESSAGE.altcha!, "altcha");
  if (!(await rateLimit(ctx.db, clientKeyFrom(req.headers), "follow", DAILY_LIMIT)))
    return fail(429, "rate_limited", "Too many sign-ups from this connection today. Please try again tomorrow.");

  try {
    await requestEmailFollow(ctx, parsed.value);
  } catch (e) {
    console.error("follow request failed:", errorText(e));
    return fail(503, "unavailable", "We could not send the email just now. Please try again in a few minutes.");
  }
  return Response.json({ ok: true, message: `Check your inbox to confirm. The link works for ${CONFIRM_TTL_DAYS} days.` }, { headers: { "cache-control": "no-store" } });
}
