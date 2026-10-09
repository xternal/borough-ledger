import { errorText, handleResendEvent, verifyResendSignature } from "@borough-ledger/server";
import { EMAIL_ALERTS } from "@/lib/follow";
import { getServer } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 64_000;

/**
 * Resend webhook: bounces and spam complaints delete the subscription. Without
 * RESEND_WEBHOOK_SECRET the endpoint is off (404). A request must carry a valid
 * signature less than five minutes old; every verified event gets 200, even
 * ones we ignore, so Resend does not retry them. Never logs the event (it holds
 * an email address).
 */
export async function POST(req: Request) {
  if (!EMAIL_ALERTS) return new Response("Not found", { status: 404 });
  const { config, db } = await getServer();
  const secret = config.mail.resendWebhookSecret;
  if (!secret) return new Response("Not found", { status: 404 });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return new Response("Payload too large", { status: 413 });
  const ok = verifyResendSignature(
    secret,
    { id: req.headers.get("svix-id"), timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") },
    raw,
  );
  if (!ok) return new Response("Invalid signature", { status: 401 });

  let event: unknown = null;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ ok: true });
  }
  try {
    await handleResendEvent({ db, config }, event);
  } catch (e) {
    console.error("resend event failed:", errorText(e));
    return new Response("Error", { status: 500 });
  }
  return Response.json({ ok: true });
}
