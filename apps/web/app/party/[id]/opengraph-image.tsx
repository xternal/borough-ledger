import { DATA } from "@borough-ledger/schema";
import { buildModel } from "@/lib/model";
import { OG_SIZE, collectionImage, statusPills } from "@/lib/ogCollection";
import { STATUS_LABEL, STATUS_ORDER, standing } from "@/lib/promises";
import { partiesOf } from "@/lib/topics";

export const alt = "A party's 2026 manifesto pledges, tracked by Borough Book";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return DATA.content.parties.filter((pt) => DATA.content.promises.some((p) => p.actor.kind === "party" && p.actor.id === pt.id)).map((pt) => ({ id: pt.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = buildModel();
  const party = partiesOf(m).find((x) => x.id === id)!;
  return collectionImage({
    kicker: `${party.seats} of ${m.people.councillors.length} seats`,
    title: `${party.name}: 2026 manifesto pledges`,
    line: standing(party.promises).join(" "),
    pills: statusPills(party.promises.map((p) => p.status), (s) => STATUS_LABEL[s as keyof typeof STATUS_LABEL], STATUS_ORDER),
    place: m.place.short,
  });
}
