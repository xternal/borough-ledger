import { DATA } from "@borough-ledger/schema";
import { buildModel } from "@/lib/model";
import { OG_SIZE, collectionImage, statusPills } from "@/lib/ogCollection";
import { STATUS_LABEL, STATUS_ORDER, standing } from "@/lib/promises";
import { topicSlug, topicsOf } from "@/lib/topics";

export const alt = "Party pledges on one topic, tracked by Borough Book";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return [...new Set(DATA.content.promises.map((p) => p.area))].map((a) => ({ slug: topicSlug(a) }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = buildModel();
  const t = topicsOf(m).find((x) => x.slug === slug)!;
  return collectionImage({
    kicker: m.place.short,
    title: `${t.area}: what the parties promised`,
    line: standing(t.promises).join(" "),
    pills: statusPills(t.promises.map((p) => p.status), (s) => STATUS_LABEL[s as keyof typeof STATUS_LABEL], STATUS_ORDER),
    place: m.place.short,
  });
}
