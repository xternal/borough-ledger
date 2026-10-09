import { formatMonth } from "@/lib/format";
import { collectionImage } from "@/lib/ogCollection";
import { KIND_LABEL, suppliersById } from "@/lib/payments";

/**
 * Share image for a supplier's page, drawn when first asked for: there are thousands of suppliers, too many to draw at
 * every build. The name, what kind of organisation it is and the months it was paid in. No money: the page shows it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = suppliersById().get(id);
  if (!s?.page) return new Response("Not found", { status: 404 });
  return collectionImage({
    kicker: "Council supplier",
    title: s.name,
    line: `Payments over £500 from Hammersmith & Fulham Council, ${formatMonth(s.first)} to ${formatMonth(s.last)}, by month and service, from the council's own spend files.`,
    pills: [KIND_LABEL[s.kind]],
    place: "Hammersmith & Fulham",
  });
}
