import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Num } from "@/components/Num";
import { PageShell } from "@/components/PageShell";
import { QualityGroup } from "@/components/QualityLegend";
import { formatDay, formatMonth, formatMonthShort } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { GROUP_QUALITY, KIND_LABEL, PAY, filesFor, groupLabel, payFig, suppliersById } from "@/lib/payments";
import { SITE } from "@/lib/site";
import { supplierJsonLd } from "@/lib/structured";

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;

/** Pages only for companies, charities and public bodies (docs/PRIVACY.md). */
export function generateStaticParams() {
  return [...suppliersById().values()].filter((s) => s.page).map((s) => ({ id: s.id }));
}

function supplier(id: string) {
  const s = suppliersById().get(id);
  return s?.page ? s : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = supplier(id);
  if (!s) return {};
  const title = `${s.name}: payments from Hammersmith & Fulham Council | ${SITE.name}`;
  const description = `What Hammersmith & Fulham Council paid ${s.name}, by month and service, from the council's own spend files (${formatMonth(s.first)} to ${formatMonth(s.last)}).`;
  return { title, description, alternates: { canonical: `/supplier/${id}` }, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default async function SupplierPage({ params }: Props) {
  const { id } = await params;
  const s = supplier(id);
  if (!s) notFound();
  const m = buildModel();
  const months = Object.keys(s.months);
  const files = filesFor(months);
  const f = (v: number) => payFig(v, files);
  const max = Math.max(...Object.values(s.months).map(Math.abs));
  const groups = Object.entries(s.groups);
  const gmax = Math.max(...groups.map(([, v]) => Math.abs(v)));
  const ch = `https://find-and-update.company-information.service.gov.uk/search?q=${encodeURIComponent(s.name)}`;

  return (
    <PageShell m={m}>
      <div className="hero">
        <p className="small">
          <a href="/payments">All payments</a>
        </p>
        <h1>{s.name}</h1>
        <p className="lede">
          {KIND_LABEL[s.kind]}. {m.place.short} Council paid it{" "}
          <b>
            <Num f={f(s.total)} fmt="gbp0" />
          </b>{" "}
          in <Num f={f(s.rows)} fmt="int" /> payments in the council&rsquo;s files from {formatMonth(s.first)} to {formatMonth(s.last)}, excluding VAT.
        </p>
        <p className="small muted">
          The name is as the council wrote it.
          {s.kind === "company" ? (
            <>
              {" "}
              <a href={ch}>Search Companies House</a> for the registered company; we do not link one automatically unless the match is certain.
            </>
          ) : null}
        </p>
      </div>

      <section aria-labelledby="by-service-h" className="pay-section">
        <div className="sec-head">
          <h2 id="by-service-h">By service</h2>
        </div>
        <div className="mbars mbars-wide">
          {groups.map(([g, v]) => (
            <div className="mbar" key={g}>
              <span className="mbar-l">{groupLabel(g)}</span>
              <span className="mbar-track" aria-hidden="true">
                <i style={{ width: `${(Math.max(v, 0) / gmax) * 100}%` }} />
              </span>
              <span className="mbar-v">
                <Num f={f(v)} fmt="gbp0" />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="by-month-h" className="pay-section">
        <div className="sec-head">
          <h2 id="by-month-h">By month</h2>
          <p>Months with no payment to {s.name} are left out. Pick a month to see every payment the council made that month.</p>
        </div>
        <div className="mbars">
          {Object.entries(s.months).map(([mo, v]) => (
            <a className="mbar" key={mo} href={`/payments/${mo}`}>
              <span className="mbar-l">{formatMonthShort(mo)}</span>
              <span className="mbar-track" aria-hidden="true">
                <i style={{ width: `${(Math.max(v, 0) / max) * 100}%` }} />
              </span>
              <span className="mbar-v">
                <Num f={payFig(v, filesFor([mo]))} fmt="gbp0" />
              </span>
            </a>
          ))}
        </div>
      </section>

      <section aria-labelledby="largest-h" className="pay-section">
        <div className="sec-head">
          <h2 id="largest-h">Largest payments</h2>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Service</th>
                <th>What for</th>
                <th className="n">Amount</th>
              </tr>
            </thead>
            <tbody>
              {s.top.map(([date, amount, g, type], i) => (
                <tr key={i}>
                  <td>{formatDay(date)}</td>
                  <td className="wrap-cell">{groupLabel(g)}</td>
                  <td className="wrap-cell">{type}</td>
                  <td className="n">
                    <Num f={payFig(amount, filesFor([date.slice(0, 7)]))} fmt="gbp2" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="qrow">
          <QualityGroup q={PAY.meta.quality} text="Amounts: the council's own figures, excluding VAT" />
          <QualityGroup q={GROUP_QUALITY} text="Services: matched by us from the council's service areas" />
        </div>
        <p className="muted small">
          From {files.length === 1 ? "the council's spend file" : `${files.length} of the council's spend files`}:{" "}
          {PAY.sources
            .filter((x) => files.includes(x.id))
            .map((x, i) => (
              <span key={x.id}>
                {i ? ", " : ""}
                <a href={x.url}>{x.title}</a>
              </span>
            ))}
          .
        </p>
      </section>
      <JsonLd data={supplierJsonLd(s)} />
    </PageShell>
  );
}
