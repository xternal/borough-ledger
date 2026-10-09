import { PaymentSuppliersFile } from "@borough-ledger/schema";
import { formatMonth } from "@/lib/format";
import { collectionImage } from "@/lib/ogCollection";
import { KIND_LABEL } from "@/lib/payments";
// Bundled into the function: it runs on request, where the repository's data folder is not there to read.
import suppliersRaw from "../../../../../../data/build/payments/suppliers.json";

let byId: Map<string, PaymentSuppliersFile["suppliers"][number]> | null = null;
const suppliers = () => (byId ??= new Map(PaymentSuppliersFile.parse(suppliersRaw).suppliers.map((s) => [s.id, s])));

/**
 * Share image for a supplier's page, drawn when first asked for: there are thousands of suppliers, too many to draw at
 * every build. The name, what kind of organisation it is and the months it was paid in. No money: the page shows it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = suppliers().get(id);
  if (!s?.page) return new Response("Not found", { status: 404 });
  return collectionImage({
    kicker: "Council supplier",
    title: s.name,
    line: `Payments over £500 from Hammersmith & Fulham Council, ${formatMonth(s.first)} to ${formatMonth(s.last)}, by month and service, from the council's own spend files.`,
    pills: [KIND_LABEL[s.kind]],
    place: "Hammersmith & Fulham",
  });
}
