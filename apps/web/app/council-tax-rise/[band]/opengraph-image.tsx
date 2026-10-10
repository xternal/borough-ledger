import { DATA, bandsOf, type Band } from "@borough-ledger/schema";
import { buildModel } from "@/lib/model";
import { OG_SIZE } from "@/lib/ogCollection";
import { optionsImage } from "@/lib/ogOptions";

export const alt = "What the council's three council tax options for next year would add to one band's bill in Hammersmith & Fulham, on Borough Book";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return bandsOf(DATA.rules).map((b) => ({ band: `band-${b.toLowerCase()}` }));
}

export default async function Image({ params }: { params: Promise<{ band: string }> }) {
  const { band } = await params;
  return optionsImage(buildModel(), band.replace(/^band-/, "").toUpperCase() as Band);
}
