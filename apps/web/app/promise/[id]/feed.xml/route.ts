import { DATA } from "@borough-ledger/schema";
import { promiseFeed } from "@/lib/feeds";
import { feedResponse } from "@/lib/rss";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DATA.content.promises.map((p) => ({ id: p.id }));
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const feed = promiseFeed(id);
  return feed ? feedResponse(feed) : new Response("Not found", { status: 404 });
}
