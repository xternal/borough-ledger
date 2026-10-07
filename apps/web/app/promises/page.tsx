import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { Num } from "@/components/Num";
import { PageShell } from "@/components/PageShell";
import { PromisesIndex } from "@/components/PromisesIndex";
import { buildModel } from "@/lib/model";
import { STATUS_LABEL, STATUS_MEANS, STATUS_ORDER, sides } from "@/lib/promises";
import { SITE } from "@/lib/site";
import { promisesJsonLd } from "@/lib/structured";

export const revalidate = 86400;

const title = `Promises made to Hammersmith & Fulham residents | ${SITE.name}`;
const description =
  "Every headline pledge from the 2026 Labour and Conservative manifestos for Hammersmith & Fulham, quoted word for word with its source, its status and its cost to the council, tracked to the same rules for every party.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/promises" },
  openGraph: { title, description },
  twitter: { card: "summary_large_image", title, description },
};

export default function PromisesPage() {
  const m = buildModel();
  const groups = sides(m.promises);
  const used = STATUS_ORDER.filter((s) => m.promises.some((p) => p.status === s));
  const seatsOf = (party: string) => m.people.councillors.filter((c) => c.party === party).length;
  return (
    <PageShell m={m}>
      <div className="hero">
        <h1>Promises</h1>
        <p className="lede">
          What each party promised {m.place.short} in its 2026 manifesto, quoted word for word, and where each pledge stands now. Every party is held to the
          same rules.
        </p>
      </div>

      <div className="kpis kpis-3">
        <div className="kpi">
          <span className="l">Pledges tracked</span>
          <span className="v">{m.promises.length}</span>
          <span className="s">headline pledges from {groups.reduce((a, g) => a + g.parties.length, 0)} manifestos, May 2026</span>
        </div>
        {groups.map((g) => (
          <div className="kpi" key={g.id}>
            <span className="l">{g.label}</span>
            <span className="v">{g.count}</span>
            <span className="s">
              pledges;{" "}
              {g.id === "administration" ? (
                <>
                  <Num f={m.politics.seats} fmt="int" /> of <Num f={m.politics.totalSeats} fmt="int" /> seats
                </>
              ) : (
                g.parties.map((p, i) => (
                  <span key={p}>
                    {i ? ", " : ""}
                    <Num f={{ ...m.politics.seats, value: seatsOf(p) }} fmt="int" /> seats
                  </span>
                ))
              )}
            </span>
          </div>
        ))}
      </div>

      <section aria-labelledby="list-h" className="plist-section">
        <h2 id="list-h" className="sr-only">
          All pledges
        </h2>
        <PromisesIndex promises={m.promises} />
      </section>

      <section aria-labelledby="how-h" className="pay-section">
        <div className="sec-head">
          <h2 id="how-h">How pledges are tracked</h2>
          <p>
            Each party&rsquo;s own headline pledges get a card, quoted exactly with the manifesto page and an archived copy. The party with more than half the
            seats runs the council; the same rules apply to every party.
          </p>
        </div>
        <dl className="statuses">
          {used.map((s) => (
            <div key={s}>
              <dt>
                <span className={`pill st-${s}`}>{STATUS_LABEL[s]}</span>
              </dt>
              <dd>{STATUS_MEANS[s]}</dd>
            </div>
          ))}
        </dl>
        <p className="muted small">
          A pledge moves up only on evidence from council papers. Any councillor or party named on a card can reply, and replies are published. Who
          represents you: <a href="/councillors">councillors by ward</a>.
        </p>
      </section>
      <JsonLd data={promisesJsonLd(m.promises)} />
    </PageShell>
  );
}
