import type { Metadata } from "next";
import { LedgerStateProvider } from "@/components/LedgerState";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Promises } from "@/components/Promises";
import { buildModel } from "@/lib/model";
import { formatDay } from "@/lib/format";
import { SITE } from "@/lib/site";
import { promisesJsonLd } from "@/lib/structured";

export const revalidate = 86400;

const title = `Promises and councillors in Hammersmith & Fulham | ${SITE.name}`;
const description =
  "Every headline pledge from the 2026 Labour and Conservative manifestos for Hammersmith & Fulham, quoted word for word with its source, cost and progress, and the borough's 50 councillors by ward.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/promises" },
  openGraph: { title, description },
  twitter: { card: "summary_large_image", title, description },
};

export default function PromisesPage() {
  const m = buildModel();
  const byId = new Map(m.people.councillors.map((c) => [c.id, c]));
  return (
    <PageShell m={m}>
      <div className="hero">
        <h1>Promises</h1>
        <p className="lede">
          Each party&rsquo;s headline pledges from its 2026 manifesto, quoted word for word, with the page they come from. Every party is held to the
          same rules: a pledge from a party that does not run the council is an opposition pledge, and a pledge with no who, how much, when or from
          where is marked unscoreable.
        </p>
      </div>
      <LedgerStateProvider input={m.balance.input}>
        <Promises promises={m.promises} today={m.today} generalBudget={m.generalBudget} balance={m.balance} heading={false} />
      </LedgerStateProvider>
      <section id="councillors" aria-labelledby="councillors-h">
        <div className="sec-head">
          <h2 id="councillors-h">Councillors</h2>
          <p>
            {m.people.councillors.length} councillors in {m.people.wards.length} wards, from the council&rsquo;s own records on{" "}
            {formatDay(m.people.retrievedOn)}.
          </p>
        </div>
        <div className="wards">
          {m.people.wards.map((w) => (
            <div className="ward" key={w.id}>
              <h3>{w.name}</h3>
              <ul>
                {w.councillor_ids.map((id) => {
                  const c = byId.get(id)!;
                  return (
                    <li key={id}>
                      <a href={`/councillor/${id}`}>{c.name}</a> <span className="muted">{c.party}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <JsonLd data={promisesJsonLd(m.promises)} />
    </PageShell>
  );
}
