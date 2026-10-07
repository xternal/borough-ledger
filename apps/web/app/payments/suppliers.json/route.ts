import { suppliersById } from "@/lib/payments";

export const dynamic = "force-static";

/** Every organisation in the ledger, largest first, for the search box on /payments: [id, name, total, has a page]. */
export function GET() {
  const list = [...suppliersById().values()].map((s) => [s.id, s.name, s.total, s.page]);
  return Response.json(list, { headers: { "cache-control": "public, max-age=3600" } });
}
