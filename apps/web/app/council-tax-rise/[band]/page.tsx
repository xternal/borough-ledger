import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BANDS, DATA, bandsOf, type Band } from "@borough-ledger/schema";
import { CouncilTaxRise } from "@/components/CouncilTaxRise";
import { buildModel } from "@/lib/model";
import { share } from "@/lib/share";
import { SITE } from "@/lib/site";

type Props = { params: Promise<{ band: string }> };

export const revalidate = 86400;
export const dynamicParams = false;

/** /council-tax-rise/band-c: one page per band, so a link shared for a band opens on it, with its own share card. */
export function generateStaticParams() {
  return bandsOf(DATA.rules).map((b) => ({ band: `band-${b.toLowerCase()}` }));
}

function bandOf(slug: string): Band | null {
  const b = slug.replace(/^band-/, "").toUpperCase();
  return (BANDS as readonly string[]).includes(b) && bandsOf(DATA.rules).includes(b as Band) ? (b as Band) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const band = bandOf((await params).band);
  if (!band) return {};
  const path = `/council-tax-rise/band-${band.toLowerCase()}`;
  const title = `Band ${band} council tax in Hammersmith & Fulham next year: the council's three options | ${SITE.name}`;
  const description = `What the council's options for 2027/28 (its share up 100%, 125% or 150%) would mean for a Band ${band} home in Hammersmith & Fulham: the whole bill, the extra a week, and how to have your say. Independent, from the council's own report.`;
  return { title, description, alternates: { canonical: path }, ...share(path, title, description, { own: true }) };
}

export default async function BandPage({ params }: Props) {
  const band = bandOf((await params).band);
  const m = buildModel();
  if (!band || !m.ctOptions) notFound();
  return <CouncilTaxRise m={m} band={band} path={`/council-tax-rise/band-${band.toLowerCase()}`} />;
}
