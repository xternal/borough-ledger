import type { Metadata } from "next";
import { Method } from "@/components/Method";
import { SectionPage } from "@/components/SectionPage";
import { buildModel } from "@/lib/model";
import { share } from "@/lib/share";
import { SITE } from "@/lib/site";
import { sectionJsonLd } from "@/lib/structured";

/** Rebuilt daily, like the home page it is part of. */
export const revalidate = 86400;

function words() {
  const m = buildModel();
  const name = `How ${SITE.name} works`;
  const description = `The rules a council lives by, how every figure on ${SITE.name} is labelled and where it comes from, and answers to common questions about council tax and the budget in ${m.place.short}. An independent project, not run by the council.`;
  return { m, name, description };
}

export function generateMetadata(): Metadata {
  const { name, description } = words();
  const title = `${name}: the rules, the sources and your questions | ${SITE.name}`;
  return { title, description, alternates: { canonical: "/method" }, ...share("/method", title, description) };
}

/** How it works on its own: the council's rules, the quality labels, the sources and the questions. */
export default function MethodPage() {
  const { m, name, description } = words();
  return (
    <SectionPage m={m} section="method" jsonLd={sectionJsonLd("/method", name, description)}>
      <Method m={m} view="own" />
    </SectionPage>
  );
}
