import { DATA } from "@borough-ledger/schema";
import { councillorFeed } from "@/lib/feeds";
import { feedResponse } from "@/lib/rss";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DATA.content.councillors.map((c) => ({ id: c.id }));
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const feed = councillorFeed(id);
  return feed ? feedResponse(feed) : new Response("Not found", { status: 404 });
}
