import { DATA } from "@borough-ledger/schema";
import { buildModel } from "@/lib/model";
import { promiseMarkdown } from "@/lib/promiseText";
import { SITE_URL } from "@/lib/site";

/* Served at /promise/<id>.md (a rewrite in next.config.ts): the card as Markdown for AI tools (llmstxt.org).
   The HTML page stays the canonical one, so search engines never see the two as duplicates. */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DATA.content.promises.map((p) => ({ id: p.id }));
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = buildModel();
  const p = m.promises.find((x) => x.id === id);
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(promiseMarkdown(p, m), {
    headers: { "content-type": "text/markdown; charset=utf-8", link: `<${SITE_URL}/promise/${id}>; rel="canonical"` },
  });
}
