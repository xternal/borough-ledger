import { createSpamChallenge } from "@borough-ledger/server";
import { EMAIL_ALERTS } from "@/lib/follow";
import { getServer } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A fresh proof-of-work challenge for the spam check on the email form (self-hosted ALTCHA; no cookies, no third party). */
export async function GET() {
  if (!EMAIL_ALERTS) return new Response("Not found", { status: 404 });
  const { config } = await getServer();
  return Response.json(await createSpamChallenge(config), { headers: { "cache-control": "no-store" } });
}
