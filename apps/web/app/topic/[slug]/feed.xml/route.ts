import { DATA } from "@borough-ledger/schema";
import { topicFeed } from "@/lib/feeds";
import { feedResponse } from "@/lib/rss";
import { topicSlug } from "@/lib/topics";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [...new Set(DATA.content.promises.map((p) => p.area))].map((a) => ({ slug: topicSlug(a) }));
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feed = topicFeed(slug);
  return feed ? feedResponse(feed) : new Response("Not found", { status: 404 });
}
