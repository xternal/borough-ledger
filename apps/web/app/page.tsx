import { LedgerPage } from "@/components/LedgerPage";
import { buildModel } from "@/lib/model";

/** Rebuilt daily so "today" on promise timelines and overdue filters stays current. */
export const revalidate = 86400;

export default function Home() {
  return <LedgerPage m={buildModel()} />;
}
