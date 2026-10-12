import type { Metadata } from "next";
import type { Figure } from "@borough-ledger/schema";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DecodedBill } from "@/components/DecodedBill";
import { DecoderFinder } from "@/components/DecoderFinder";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Num } from "@/components/Num";
import { TopBar } from "@/components/TopBar";
import { DECODER, cap, decodedCouncil, decodedCouncils, type DecodedCouncil } from "@/lib/decoder";
import { DECODER_NAV } from "@/lib/decoderPage";
import { format } from "@/lib/format";
import { listOf } from "@/lib/letter";
import { share } from "@/lib/share";
import { SITE, SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return decodedCouncils().map((c) => ({ slug: c.slug }));
}

const abs = (f: Figure): Figure => ({ ...f, value: Math.abs(f.value) });
/** "rose £81.39", "fell £12.07", "did not change". */
function moved(f: Figure) {
  if (Math.abs(f.value) < 0.005) return "did not change";
  return (
    <>
      {f.value > 0 ? "rose" : "fell"} <Num f={abs(f)} fmt="gbp2" />
    </>
  );
}

function words(c: DecodedCouncil) {
  const others = c.parts.filter((p) => p.id !== "council" && p.f.value > 0);
  const title = `Council tax in ${c.place} ${DECODER.yearLabel}: where your Band D bill goes | ${SITE.name}`;
  const description = `A Band D home in ${c.place} pays ${format("gbp2", c.total.value)} in ${DECODER.yearLabel}, ${c.change.value >= 0 ? "up" : "down"} ${format("gbp2", Math.abs(c.change.value))} on last year. ${cap(c.councilName)} keeps ${format("gbp2", c.parts[0]!.f.value)}; the rest goes to ${listOf(others.map((p) => p.body))}. From the government's own tables.`;
  return { title, description };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = decodedCouncil((await params).slug);
  if (!c) return {};
  const { title, description } = words(c);
  return { title, description, alternates: { canonical: `/council-tax/${c.slug}` }, ...share(`/council-tax/${c.slug}`, title, description, { own: true }) };
}

export default async function CouncilDecoded({ params }: Props) {
  const c = decodedCouncil((await params).slug);
  if (!c) notFound();
  const { description } = words(c);
  const own = c.parts.find((p) => p.id === "council")!;
  const others = c.parts.filter((p) => p.id !== "council" && p.f.value > 0);
  const precepting = c.parts.filter((p) => ["county", "police", "fire", "combined"].includes(p.id) && (p.f.value > 0 || p.prev.value > 0));
  const up = c.change.value >= 0;
  return (
    <>
      <TopBar place={c.name} year={DECODER.yearLabel} borough={{ base: "/council-tax", items: DECODER_NAV, current: "councils" }} />
      <main className="wrap" id="top">
        <div className="hero">
          <p className="small muted">
            <Link href="/council-tax">Council tax decoder</Link> &rsaquo; {c.region}
          </p>
          <h1>
            Council tax in {c.place}, {DECODER.yearLabel}
          </h1>
          <p className="lede">
            A Band D home in {c.place} pays <Num f={c.total} fmt="gbp2" /> this year, on average, {up ? "up" : "down"}{" "}
            <Num f={abs(c.change)} fmt="gbp2" /> (<Num f={abs(c.changePct)} fmt="pct1" />) on{" "}
            {DECODER.prevLabel}. {cap(c.councilName)} keeps <Num f={own.f} fmt="gbp2" /> (<Num f={own.share} fmt="share0" />); the rest goes to{" "}
            {others.map((p, i) => (
              <span key={p.id}>
                {i ? (i === others.length - 1 ? " and " : ", ") : ""}
                {p.id === "parish" ? "parish and town councils" : p.body} (<Num f={p.f} fmt="gbp2" />)
              </span>
            ))}
            .
          </p>
        </div>

        <section id="bill" aria-labelledby="bill-h">
          <div className="sec-head">
            <h2 id="bill-h">Who gets your Band D bill</h2>
            <p>
              {c.kind === "district council"
                ? `${c.name} is a district: the county council above it sets most of the bill, and ${c.councilName} collects it with its own share.`
                : c.kind === "London borough"
                  ? `In London, the Mayor of London adds a share for London-wide services such as policing, the fire brigade and transport.`
                  : `${cap(c.councilName)} runs every council service here, and collects the shares of the bodies below with its own.`}
            </p>
          </div>
          <DecodedBill c={c} />
        </section>

        <section id="change" aria-labelledby="change-h">
          <div className="sec-head">
            <h2 id="change-h">What changed on {DECODER.prevLabel}</h2>
          </div>
          <p>
            The Band D bill went {up ? "up" : "down"} <Num f={abs(c.change)} fmt="gbp2" /> a year. {cap(c.councilName)}&rsquo;s own share{" "}
            {moved(c.ownChange)}
            {precepting.length ? (
              <>
                ; {listOf(precepting.map((p) => p.body))} {moved(c.preceptChange)}
                {precepting.length > 1 ? " between them" : ""}
              </>
            ) : null}
            {Math.abs(c.parishChange.value) >= 0.005 ? <>; parish and town councils, on average, {moved(c.parishChange)}</> : null}.
          </p>
          {c.sitePage ? (
            <p>
              BoroughBook.UK has a fuller page for {c.name}: its budget, councillors and more. <Link href={c.sitePage}>See {c.name}</Link>.
            </p>
          ) : null}
        </section>

        <section id="find" aria-labelledby="find-h">
          <div className="sec-head">
            <h2 id="find-h">Not your council?</h2>
          </div>
          <DecoderFinder />
          <p className="small muted">
            Or <Link href="/council-tax#councils">pick it from the list</Link>. Bills are for Band D and two adults; other bands pay a fixed share of Band D, and
            someone living alone gets 25% off. From{" "}
            {DECODER.sources.map((s, i) => (
              <span key={s.url + s.title}>
                {i ? " and " : ""}
                <a href={s.url}>{s.title}</a>
              </span>
            ))}
            .
          </p>
        </section>
        <Footer council={c.name} hasTestData={false} />
      </main>
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "WebPage", name: `Council tax in ${c.place}, ${DECODER.yearLabel}`, description, url: `${SITE_URL}/council-tax/${c.slug}`, inLanguage: "en-GB", about: { "@type": "GovernmentOrganization", name: cap(c.councilName.replace(/^the /, "")) } },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Council tax decoder", item: `${SITE_URL}/council-tax` },
              { "@type": "ListItem", position: 3, name: c.name, item: `${SITE_URL}/council-tax/${c.slug}` },
            ],
          },
        ]}
      />
    </>
  );
}
