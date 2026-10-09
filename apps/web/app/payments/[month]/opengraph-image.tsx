import { formatMonth } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { OG_SIZE, collectionImage } from "@/lib/ogCollection";
import { MONTHS } from "@/lib/payments";

export const alt = "A month of council payments over £500 in Hammersmith & Fulham, on Borough Book";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return MONTHS.map((month) => ({ month }));
}

/** The month and what the page holds. Counts, never money, so it can never carry an unmarked figure. */
export default async function Image({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const m = buildModel();
  return collectionImage({
    kicker: "Payments over £500",
    title: `Council payments, ${formatMonth(month)}`,
    line: "Every payment in the council's own spend file, by organisation and service. Payments to people are shown only as totals, and nobody is named.",
    pills: ["By organisation", "By service", "Checked against the file"],
    place: m.place.short,
  });
}
