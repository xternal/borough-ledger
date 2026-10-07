import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { formatDay } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { SITE, SITE_URL } from "@/lib/site";
import { groupSources } from "@/lib/sources";

const title = `Sources for Hammersmith & Fulham's money and promises | ${SITE.name}`;
const description =
  "Every document behind Borough Ledger: the council's budget papers and spend files, government council tax and spending returns, the laws a council budget must follow, and both parties' 2026 manifestos.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/sources" },
  openGraph: { title, description },
  twitter: { card: "summary_large_image", title, description },
};

export default function SourcesPage() {
  const m = buildModel();
  const groups = groupSources(m.sources);
  return (
    <PageShell m={m}>
      <div className="hero">
        <h1>Sources</h1>
        <p className="lede">
          Every figure on Borough Ledger comes from one of these {m.sources.length} published documents, and links to it. Where we read a file, we keep its
          SHA-256 fingerprint, so anyone can check it is the same file.
        </p>
      </div>
      {groups.map((g) => (
        <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="pay-section">
          <div className="sec-head">
            <h2 id={`${g.id}-h`}>{g.label}</h2>
            {g.desc ? <p>{g.desc}</p> : null}
          </div>
          <ul className="source-list">
            {g.items.map((s) => (
              <li key={s.id}>
                <a href={s.url}>{s.title}</a>
                <span className="small muted block">
                  {[s.publisher, s.published_on ? `published ${formatDay(s.published_on)}` : null, s.licence].filter(Boolean).join(", ")}
                  {s.asset_url && s.asset_url !== s.url ? (
                    <>
                      {" "}
                      <a href={s.asset_url}>file</a>
                    </>
                  ) : null}
                  {s.sha256 ? (
                    <>
                      {" "}
                      <code title={s.sha256}>{s.sha256.slice(0, 12)}&hellip;</code>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Sources",
          url: `${SITE_URL}/sources`,
          inLanguage: "en-GB",
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: m.sources.length,
            itemListElement: m.sources.map((s, i) => ({ "@type": "ListItem", position: i + 1, name: s.title, url: s.url })),
          },
        }}
      />
    </PageShell>
  );
}
