import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaymentsLedger } from "@/components/PaymentsLedger";
import { formatMonth } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { feedAlternate } from "@/lib/rss";
import { MONTHS } from "@/lib/payments";
import { SITE } from "@/lib/site";
import { share } from "@/lib/share";

type Props = { params: Promise<{ month: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return MONTHS.map((month) => ({ month }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { month } = await params;
  if (!MONTHS.includes(month)) return {};
  const title = `Council payments, ${formatMonth(month)} | ${SITE.name}`;
  const description = `Every payment Hammersmith & Fulham Council published for ${formatMonth(month)}, by organisation and service, from the council's own spend file.`;
  return { title, description, alternates: { canonical: `/payments/${month}`, types: feedAlternate("/payments/feed.xml", "Payments over £500, month by month") }, ...share(`/payments/${month}`, title, description, { own: true }) };
}

export default async function PaymentsMonthPage({ params }: Props) {
  const { month } = await params;
  if (!MONTHS.includes(month)) notFound();
  return <PaymentsLedger m={buildModel()} month={month} />;
}
