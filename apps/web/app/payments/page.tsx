import type { Metadata } from "next";
import { PaymentsLedger } from "@/components/PaymentsLedger";
import { formatMonth } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { LATEST, PAY } from "@/lib/payments";
import { SITE } from "@/lib/site";

const title = `Payments over £500 by Hammersmith & Fulham Council | ${SITE.name}`;
const description = `Search every payment in Hammersmith & Fulham Council's spend files, ${formatMonth(PAY.months[0]!.month)} to ${formatMonth(LATEST)}: who was paid, for which service and how much, checked against the council's own files.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/payments" },
  openGraph: { title, description },
  twitter: { card: "summary_large_image", title, description },
};

export default function PaymentsPage() {
  return <PaymentsLedger m={buildModel()} month={LATEST} />;
}
