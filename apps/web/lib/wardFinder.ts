/* Postcode to ward, in the reader's browser. The postcode goes from the browser to postcodes.io (a free, open
   service using ONS data) in the body of an encrypted request, so it is never in an address or our logs.
   We never see it and nothing is stored (docs/PRIVACY.md). */

export const POSTCODES_IO = "https://api.postcodes.io/postcodes?filter=postcode,admin_district,codes";

export type FinderWard = { id: string; name: string; ons_code: string };

export type Lookup =
  | { kind: "ward"; id: string; name: string; postcode: string }
  | { kind: "elsewhere"; district: string; postcode: string }
  | { kind: "not_found" }
  | { kind: "invalid" }
  | { kind: "error" };

/** "w69ju" or "W6 9JU" → "W6 9JU". Whole postcodes only; null when it cannot be one. */
export function normalisePostcode(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(s)) return null;
  return `${s.slice(0, -3)} ${s.slice(-3)}`;
}

type Result = { postcode?: string; admin_district?: string | null; codes?: { admin_ward?: string | null; admin_district?: string | null } } | null;

/** Reads one postcodes.io result: one of our wards, somewhere else, or not found. */
export function wardFromResult(result: Result, wards: readonly FinderWard[], councilCode: string): Lookup {
  if (!result) return { kind: "not_found" };
  const postcode = result.postcode ?? "";
  const ward = wards.find((w) => w.ons_code === result.codes?.admin_ward);
  if (ward && result.codes?.admin_district === councilCode) return { kind: "ward", id: ward.id, name: ward.name, postcode };
  return { kind: "elsewhere", district: result.admin_district ?? "another area", postcode };
}

export async function lookupWard(input: string, wards: readonly FinderWard[], councilCode: string, fetchImpl: typeof fetch = fetch): Promise<Lookup> {
  const postcode = normalisePostcode(input);
  if (!postcode) return { kind: "invalid" };
  try {
    const res = await fetchImpl(POSTCODES_IO, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcodes: [postcode] }),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    if (!res.ok) return { kind: "error" };
    const body = (await res.json()) as { result?: { result: Result }[] };
    return wardFromResult(body.result?.[0]?.result ?? null, wards, councilCode);
  } catch {
    return { kind: "error" };
  }
}
