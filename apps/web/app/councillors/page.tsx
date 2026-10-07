import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { formatDay } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { SITE, SITE_URL } from "@/lib/site";

export const revalidate = 86400;

const title = `Councillors in Hammersmith & Fulham by ward | ${SITE.name}`;
const description =
  "All 50 Hammersmith & Fulham councillors by ward, with their party and posts, from the council's own records, and the pledges of their party.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/councillors" },
  openGraph: { title, description },
  twitter: { card: "summary_large_image", title, description },
};

export default function CouncillorsPage() {
  const m = buildModel();
  const byId = new Map(m.people.councillors.map((c) => [c.id, c]));
  const wards = [...m.people.wards].sort((a, z) => a.name.localeCompare(z.name));
  return (
    <PageShell m={m}>
      <div className="hero">
        <p className="small">
          <a href="/promises">Promises</a>
        </p>
        <h1>Councillors</h1>
        <p className="lede">
          {m.people.councillors.length} councillors in {m.people.wards.length} wards, from the council&rsquo;s own records on {formatDay(m.people.retrievedOn)}.
          Each page shows their posts and the pledges of their party.
        </p>
      </div>
      <section aria-label="Councillors by ward" className="pay-section">
        <div className="wards">
          {wards.map((w) => (
            <div className="ward" key={w.id}>
              <h3>{w.name}</h3>
              <ul>
                {w.councillor_ids.map((id) => {
                  const c = byId.get(id)!;
                  return (
                    <li key={id}>
                      <a href={`/councillor/${id}`}>{c.name}</a> <span className="muted">{c.party}</span>
                      {c.roles.length ? <span className="muted small block">{c.roles.join(", ")}</span> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Councillors",
          url: `${SITE_URL}/councillors`,
          inLanguage: "en-GB",
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: m.people.councillors.length,
            itemListElement: m.people.councillors.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: `${SITE_URL}/councillor/${c.id}` })),
          },
        }}
      />
    </PageShell>
  );
}
