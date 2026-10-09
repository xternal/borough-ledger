import "server-only";
import type { FollowContext } from "@borough-ledger/server/follow";
import { describeTarget } from "@/lib/follow";
import { getServer } from "@/lib/server";

/** Database, config, mailer and pledge names for the follow service (route handlers and the follow pages). */
export async function followContext(): Promise<FollowContext> {
  const { config, db, mail } = await getServer();
  return { config, db, mail, describe: describeTarget };
}

/** Every follow endpoint answers 404 while email is off, so nothing reaches for a database that is not there. */
export const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
