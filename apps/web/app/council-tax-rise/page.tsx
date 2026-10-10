import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CouncilTaxRise } from "@/components/CouncilTaxRise";
import { buildModel } from "@/lib/model";
import { share } from "@/lib/share";
import { SITE } from "@/lib/site";

export const revalidate = 86400;

const title = `Hammersmith & Fulham council tax next year: what a 100%, 125% or 150% rise means for you | ${SITE.name}`;
const description =
  "The council's three council tax options for 2027/28, worked out for your band: the whole bill, the extra a week, why it is happening, and how to have your say before the decision in March. Independent, from the council's own report.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/council-tax-rise" },
  ...share("/council-tax-rise", title, description, { own: true }),
};

export default function CouncilTaxRisePage() {
  const m = buildModel();
  if (!m.ctOptions) notFound();
  return <CouncilTaxRise m={m} band="D" path="/council-tax-rise" />;
}
