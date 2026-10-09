import { DATA } from "@borough-ledger/schema";
import { buildModel } from "@/lib/model";
import { OG_SIZE, collectionImage } from "@/lib/ogCollection";

export const alt = "A Hammersmith & Fulham councillor: their ward, party and posts, on Borough Book";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return DATA.content.councillors.map((c) => ({ id: c.id }));
}

/** Who the councillor is, from the council's own records: name, party, ward and posts. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = buildModel();
  const c = m.people.councillors.find((x) => x.id === id)!;
  return collectionImage({
    kicker: "Councillor",
    title: c.name,
    line: `${c.party} councillor for ${c.ward} ward. Their posts, how the ward voted, and their party's pledges, tracked to the same rules for every party.`,
    pills: [c.party, `${c.ward} ward`, ...c.roles.slice(0, 2)],
    place: m.place.short,
  });
}
