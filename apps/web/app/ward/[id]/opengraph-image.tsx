import { DATA } from "@borough-ledger/schema";
import { buildModel } from "@/lib/model";
import { OG_SIZE, collectionImage } from "@/lib/ogCollection";

export const alt = "A ward in Hammersmith & Fulham: its councillors and the pledges about it, on Borough Book";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return DATA.content.wards.wards.map((w) => ({ id: w.id }));
}

/** The ward and its councillors by name and party: text only, no figures. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = buildModel();
  const w = DATA.content.wards.wards.find((x) => x.id === id)!;
  const cllrs = m.people.councillors.filter((c) => c.wardId === id);
  return collectionImage({
    kicker: "Your ward",
    title: `${w.name} ward`,
    line: "Its councillors, how it voted in May 2026, the pledges about it and the building work the council pays for there.",
    pills: cllrs.map((c) => `${c.name}, ${c.party}`),
    place: m.place.short,
  });
}
