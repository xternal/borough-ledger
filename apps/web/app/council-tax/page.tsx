import type { Metadata } from "next";
import Link from "next/link";
import { DecoderFinder } from "@/components/DecoderFinder";
import { DataTable } from "@/components/ChartTable";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Num } from "@/components/Num";
import { QualityGroup } from "@/components/QualityLegend";
import { TopBar } from "@/components/TopBar";
import { DECODER, councilsByRegion, decoderFindings } from "@/lib/decoder";
import { DECODER_NAV, decoderQA } from "@/lib/decoderPage";
import { format } from "@/lib/format";
import { share } from "@/lib/share";
import { SITE, SITE_URL } from "@/lib/site";

const title = `Council tax decoder: where your Band D bill goes, for every council in England | ${SITE.name}`;
const description = `Put in your postcode to see where a Band D council tax bill goes in ${DECODER.yearLabel}: the council's own share, the county council or Mayor of London, police, fire, the combined authority and parish councils, and what changed on last year. All ${DECODER.count} councils in England, from the government's own tables.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/council-tax" },
  ...share("/council-tax", title, description, { own: true }),
};

export default function DecoderPage() {
  const F = decoderFindings();
  const regions = councilsByRegion();
  const qa = decoderQA();
  return (
    <>
      <TopBar place="England" year={DECODER.yearLabel} borough={{ base: "/council-tax", items: DECODER_NAV }} />
      <main className="wrap" id="top">
        <div className="hero">
          <h1>Your council tax, decoded</h1>
          <p className="lede">
            Put in your postcode to see where a Band D bill goes in {DECODER.yearLabel}: how much your council keeps, and how much goes to the county council or
            the Mayor of London, police, fire, the combined authority and parish councils, and what changed on last year. All {DECODER.count} councils in England,
            from the government&rsquo;s own tables.
          </p>
          <div className="kpis">
            <div className="kpi">
              <span className="l">Councils in England</span>
              <span className="v">{DECODER.count}</span>
              <span className="s">every one that sends a bill</span>
            </div>
            <div className="kpi">
              <span className="l">The middle council&rsquo;s own share</span>
              <span className="v">
                <Num f={F.medianOwnPct} fmt="pct1" />
              </span>
              <span className="s">up on {DECODER.prevLabel}</span>
            </div>
            <div className="kpi">
              <span className="l">The middle Band D bill</span>
              <span className="v">
                <Num f={F.medianChange} fmt="sgbp2" />
              </span>
              <span className="s">a year, on {DECODER.prevLabel}</span>
            </div>
          </div>
        </div>

        <section id="find" aria-labelledby="find-h">
          <div className="sec-head">
            <h2 id="find-h">Find your council</h2>
            <p>
              Your postcode tells us your council; you see its bill. Or <a href="#councils">pick your council from the list</a>.
            </p>
          </div>
          <DecoderFinder />
        </section>

        <section id="england" aria-labelledby="england-h">
          <div className="sec-head">
            <h2 id="england-h">Across England</h2>
            <p>
              Each council sets its own share of the bill; the county council or the Mayor of London, police, fire and combined authorities add theirs. Where did
              each drive the rise?
            </p>
          </div>
          <h3 className="care-h">Where the council&rsquo;s own share rose most</h3>
          <DataTable
            caption={`The council's own share of a Band D bill, ${DECODER.yearLabel} on ${DECODER.prevLabel}: the ten biggest rises`}
            head={["Council", "Rise, %", "Rise, £"]}
            rows={F.topOwn.map(({ c, pct }) => ({
              key: c.slug,
              cells: [<Link key="n" href={`/council-tax/${c.slug}`}>{c.name}</Link>, <Num key="p" f={pct} fmt="pct2" />, <Num key="g" f={c.ownChange} fmt="sgbp2" />],
            }))}
          />
          <p className="small muted">
            The council in the middle of all {DECODER.count} raised its own share <Num f={F.medianOwnPct} fmt="pct2" />.
          </p>
          <h3 className="care-h">Where the council froze or cut its own share, and the bill still rose</h3>
          <p>
            In {F.frozen.length} places, all of them districts, the council held its own share or cut it, yet the whole bill went up, because the county council,
            police or fire put theirs up:
          </p>
          <DataTable
            caption={`Councils that froze or cut their own share while the whole Band D bill rose, ${DECODER.yearLabel}`}
            head={["Council", "Its own share", "Whole bill"]}
            rows={F.frozen.map((c) => ({
              key: c.slug,
              cells: [<Link key="n" href={`/council-tax/${c.slug}`}>{c.name}</Link>, <Num key="o" f={c.ownChange} fmt="sgbp2" />, <Num key="t" f={c.change} fmt="sgbp2" />],
            }))}
          />
          <h3 className="care-h">Where the rest of the bill drove the rise</h3>
          <p>
            In two-tier areas the county council sets most of the bill, so it usually drives the rise. Among councils with no county council above them, these
            are where the other bodies made up the biggest part of it:
          </p>
          <DataTable
            caption={`Single-tier councils where the Mayor of London, police, fire or a combined authority made up most of the Band D rise, ${DECODER.yearLabel}`}
            head={["Council", "From the others", "Whole rise"]}
            rows={F.preceptLed.map(({ c, share: s }) => ({
              key: c.slug,
              cells: [<Link key="n" href={`/council-tax/${c.slug}`}>{c.name}</Link>, <Num key="s" f={s} fmt="share0" />, <Num key="t" f={c.change} fmt="sgbp2" />],
            }))}
          />
          <div className="qrow">
            <QualityGroup q={F.medianChange.quality} text={`Council tax requirement tables, ${DECODER.yearLabel} and ${DECODER.prevLabel}`} />
          </div>
        </section>

        <section id="councils" aria-labelledby="councils-h">
          <div className="sec-head">
            <h2 id="councils-h">Every council</h2>
            <p>All {DECODER.count} councils in England that send council tax bills, by region.</p>
          </div>
          <div className="dc-regions">
            {regions.map((r) => (
              <details key={r.region}>
                <summary>
                  {r.region} <span className="muted">({r.councils.length})</span>
                </summary>
                <ul>
                  {r.councils.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/council-tax/${c.slug}`}>{c.name}</Link> <span className="muted">{format("gbp2", c.total.value)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>

        <section id="questions" aria-labelledby="qa-h">
          <div className="sec-head">
            <h2 id="qa-h">Questions</h2>
          </div>
          <div className="faq faq-flush">
            {qa.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
          <p className="small muted">
            From{" "}
            {DECODER.sources.map((s, i) => (
              <span key={s.url + s.title}>
                {i ? " and " : ""}
                <a href={s.url}>{s.title}</a>
              </span>
            ))}
            . {DECODER.methodNote}
          </p>
        </section>
        <Footer council="England" full="any council" hasTestData={false} />
      </main>
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "WebPage", name: "Council tax decoder", description, url: `${SITE_URL}/council-tax`, inLanguage: "en-GB" },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Council tax decoder", item: `${SITE_URL}/council-tax` },
            ],
          },
          { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qa.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
          { "@context": "https://schema.org", "@type": "Dataset", name: `Council tax by billing authority, England, ${DECODER.yearLabel}`, description: DECODER.methodNote, isBasedOn: DECODER.sources.map((s) => s.url), url: `${SITE_URL}/council-tax` },
        ]}
      />
    </>
  );
}
