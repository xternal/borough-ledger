/* Postcode to council and ward, for every postcode box on the site. The reader's browser sends the postcode here, in the
   body of a POST (so it is in no address and no request log); this server asks postcodes.io and hands back only the
   council and ward codes and the council's name. postcodes.io sees our server, never the reader. Nothing is kept: no
   cache, no storage, and nothing about the postcode is logged (docs/PRIVACY.md). */
import { normalisePostcode } from "@/lib/wardFinder";

export const dynamic = "force-dynamic";

const UPSTREAM = "https://api.postcodes.io/postcodes?filter=postcode,admin_district,codes";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

type Upstream = { result?: { result: { postcode?: string; admin_district?: string | null; codes?: { admin_ward?: string | null; admin_district?: string | null } } | null }[] };

export async function POST(req: Request): Promise<Response> {
  let postcode: string | null = null;
  try {
    const body = (await req.json()) as { postcodes?: unknown };
    const one = Array.isArray(body.postcodes) && body.postcodes.length === 1 ? body.postcodes[0] : null;
    postcode = typeof one === "string" && one.length <= 12 ? normalisePostcode(one) : null;
  } catch {
    postcode = null;
  }
  if (!postcode) return reply({ error: "Send one full postcode." }, 400);
  try {
    const res = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "BoroughBook.UK (postcode to council; nothing kept)" },
      body: JSON.stringify({ postcodes: [postcode] }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return reply({ error: "The postcode service did not answer." }, 502);
    const r = ((await res.json()) as Upstream).result?.[0]?.result ?? null;
    // The same shape as postcodes.io's, cut down to what the page needs.
    const result = r
      ? { postcode: r.postcode ?? postcode, admin_district: r.admin_district ?? null, codes: { admin_ward: r.codes?.admin_ward ?? null, admin_district: r.codes?.admin_district ?? null } }
      : null;
    return reply({ result: [{ result }] });
  } catch {
    return reply({ error: "The postcode service did not answer." }, 502);
  }
}
