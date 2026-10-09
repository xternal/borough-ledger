import type { Metadata } from "next";
import { PaymentsLedger } from "@/components/PaymentsLedger";
import { formatMonth } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { LATEST, PAY } from "@/lib/payments";
import { feedAlternate } from "@/lib/rss";
import { SITE } from "@/lib/site";
import { share } from "@/lib/share";

const title = `Payments over £500 by Hammersmith & Fulham Council | ${SITE.name}`;
const description = `Search every payment in Hammersmith & Fulham Council's spend files, ${formatMonth(PAY.months[0]!.month)} to ${formatMonth(LATEST)}: who was paid, for which service and how much, checked against the council's own files.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/payments", types: feedAlternate("/payments/feed.xml", "Payments over £500, month by month") },
  ...share("/payments", title, description),
};

export default function PaymentsPage() {
  return <PaymentsLedger m={buildModel()} month={LATEST} />;
}
