import { DATA } from "@borough-ledger/schema";
import { partyFeed } from "@/lib/feeds";
import { feedResponse } from "@/lib/rss";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DATA.content.parties.filter((pt) => DATA.content.promises.some((p) => p.actor.kind === "party" && p.actor.id === pt.id)).map((pt) => ({ id: pt.id }));
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const feed = partyFeed(id);
  return feed ? feedResponse(feed) : new Response("Not found", { status: 404 });
}
