import { decisionsFeed } from "@/lib/feeds";
import { feedResponse } from "@/lib/rss";

export const dynamic = "force-static";

export function GET() {
  return feedResponse(decisionsFeed());
}
