import type { Metadata } from "next";
import { decodeScenario, encodeScenario } from "@borough-ledger/engine";
import { LedgerPage } from "@/components/LedgerPage";
import { buildModel } from "@/lib/model";
import { shareSummary } from "@/lib/shareText";
import { SITE } from "@/lib/site";

type Props = { searchParams: Promise<{ s?: string | string[] }> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const m = buildModel();
  const scenario = decodeScenario(m.balance.input, first((await searchParams).s));
  const code = encodeScenario(m.balance.input, scenario);
  const sum = shareSummary(m, scenario);
  const description = `${sum.status}. ${sum.choices.join(". ")}.${sum.later ? ` ${sum.later}.` : ""} An independent tool, not run by the council.`;
  const image = `/balance/og${code ? `?s=${encodeURIComponent(code)}` : ""}`;
  return {
    title: `${sum.title} | ${SITE.name}`,
    description,
    alternates: { canonical: "/balance" },
    openGraph: { title: sum.title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: sum.title, description, images: [image] },
  };
}

/** A shared balance-it scenario: the full statement, opened at the tool with the choices from the link. */
export default async function Balance({ searchParams }: Props) {
  const m = buildModel();
  const scenario = decodeScenario(m.balance.input, first((await searchParams).s));
  return <LedgerPage m={m} initialScenario={scenario} focus="balance" />;
}
