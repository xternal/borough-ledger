import { JsonLd } from "@/components/JsonLd";
import { FollowLink } from "@/components/FollowLink";
import { PageShell } from "@/components/PageShell";
import { formatDay, formatMonth, formatMonthShort } from "@/lib/format";
import type { PageModel } from "@/lib/model";
import { GROUP_QUALITY, GROUPS, MONTHS, PAY, companiesFile, monthFile, payFig, suppliersById } from "@/lib/payments";
import { paymentsJsonLd } from "@/lib/structured";
import { Num } from "./Num";
import { PaymentsMonth } from "./PaymentsMonth";
import { SupplierSearch } from "./SupplierSearch";

const fy = (ym: string) => {
  const [y, mo] = ym.split("-").map(Number) as [number, number];
  const start = mo >= 4 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
};

export const PAYMENTS_FAQ = [
  {
    q: "Where do these payments come from?",
    a: "From Hammersmith & Fulham Council's own spend files, which it publishes every quarter under the Local Government Transparency Code. Each file is kept with its SHA-256 fingerprint, and every month shown here adds back up to the file it came from.",
  },
  {
    q: "Why are some payments shown only as totals?",
    a: "The council redacts payments to people, such as direct payments for care, foster carers and help for families. We also hold back any payment to a payee who looks like a private individual. Those payments appear only as totals per month and service, and nobody is named.",
  },
  {
    q: "Do the amounts include VAT?",
    a: "No. The council publishes amounts excluding VAT. Credit notes appear as negative amounts.",
  },
  {
    q: "Why are some years missing?",
    a: "The council's page lists the latest quarters only, and older files were taken down. We include every file the council lists and every older file the Internet Archive kept. Files from 2015 to 2017 list every payment, including ones under £500.",
  },
];

/** /payments and /payments/[month]: every payment in one month, the month-by-month totals, and the files behind them. */
/** Suppliers whose company is in one status on the register, with the supplier page they open. */
const troubled = (status: string) =>
  Object.entries(companiesFile().companies)
    .filter(([, co]) => co.status === status)
    .map(([id, co]) => ({ id, co }));
/** "Act Too Ltd" and "ACT TOO LIMITED" are one name; "Inform CPI Ltd" and "05599551 LIMITED" are not. Brackets the council
 *  adds ("(Use 3000128)") are ignored. */
const nameKey = (n: string) =>
  n
    .toUpperCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\b(LTD|LIMITED|PLC|LLP|UK)\b/g, " ")
    .replace(/\s+/g, "");
const sameName = (a: string, b: string) => nameKey(a) === nameKey(b) || nameKey(a.replace(/\(([^)]*)\)/g, "$1")) === nameKey(b.replace(/\(([^)]*)\)/g, "$1"));
const coFig = (v: number) => ({ value: v, quality: "sourced" as const, sources: [companiesFile().source.url] });

export function PaymentsLedger({ m, month }: { m: PageModel; month: string }) {
  const idx = PAY.months.find((x) => x.month === month)!;
  const file = monthFile(month);
  const sup = suppliersById();
  const names: [string, boolean][] = file.suppliers.map((id) => {
    const s = sup.get(id);
    return [s?.name ?? id, s?.page ?? false];
  });
  const f = (v: number) => payFig(v, idx.files);
  const max = Math.max(...PAY.months.map((x) => x.total));
  const years = [...new Set(MONTHS.map(fy))];
  const pos = MONTHS.indexOf(month);
  const prev = MONTHS[pos - 1];
  const next = MONTHS[pos + 1];
  const allFiles = PAY.sources.map((s) => s.id);
  const label = formatMonth(month);

  return (
    <PageShell m={m}>
      <div className="hero">
        <h1>Payments over £500</h1>
        <p className="lede">
          Every payment {m.place.short} Council publishes, from its own quarterly spend files: who was paid, for which service, and how much. There are{" "}
          <b>
            <Num f={payFig(PAY.months.reduce((a, x) => a + x.rows, 0), allFiles)} fmt="int" />
          </b>{" "}
          payments in {PAY.months.length} months between {formatMonth(MONTHS[0]!)} and {formatMonth(MONTHS[MONTHS.length - 1]!)}. Payments to people are
          shown only as totals.
        </p>
        <FollowLink href="/payments/feed.xml" label="Follow each new month by RSS" />
      </div>

      <section id="search" aria-labelledby="search-h" className="pay-section">
        <div className="sec-head">
          <h2 id="search-h">Who the council pays</h2>
          <p>
            Search {PAY.suppliers.count.toLocaleString("en-GB")} organisations across every month. Companies, charities and public bodies have their own page, and{" "}
            {companiesFile().counts.matched!.toLocaleString("en-GB")} of them are linked to their entry on the companies register: status, type, what they do and where
            their registered office is. In the register&rsquo;s file of {formatDay(companiesFile().source.snapshot)},{" "}
            <Num f={coFig(troubled("In liquidation").length)} fmt="int" /> are in liquidation and <Num f={coFig(troubled("In administration").length)} fmt="int" /> in
            administration. That is their status, not a finding about them.
          </p>
          <details className="chart-table">
            <summary>The suppliers in liquidation or administration</summary>
            <ul className="small">
              {[...troubled("In liquidation"), ...troubled("In administration")]
                .map((x) => ({ ...x, paid: suppliersById().get(x.id)?.name ?? x.co.name }))
                .sort((a, z) => a.paid.localeCompare(z.paid))
                .map(({ id, co, paid }) => (
                  <li key={id}>
                    <a href={`/supplier/${id}`}>{paid}</a>
                    {sameName(paid, co.name) ? "" : ` (now ${co.name} on the register)`},{" "}
                    <span className="muted">{co.status.toLowerCase()}</span>
                  </li>
                ))}
            </ul>
          </details>
        </div>
        <SupplierSearch quality={PAY.meta.quality} files={allFiles} />
      </section>

      <section id="months" aria-labelledby="months-h" className="pay-section">
        <div className="sec-head">
          <h2 id="months-h">Month by month</h2>
          <p>Total paid each month. The lighter part was paid to people and is shown only as a total. Pick a month to see every payment.</p>
        </div>
        <div className="mbars">
          {years.map((y) => (
            <div className="mbars-year" key={y}>
              <h3 className="small muted">{y}</h3>
              {PAY.months
                .filter((x) => fy(x.month) === y)
                .map((x) => (
                  <a
                    key={x.month}
                    className="mbar"
                    href={`/payments/${x.month}`}
                    aria-current={x.month === month ? "page" : undefined}
                    title={`${formatMonth(x.month)}: open every payment`}
                  >
                    <span className="mbar-l">{formatMonthShort(x.month)}</span>
                    <span className="mbar-track" aria-hidden="true">
                      <i style={{ width: `${(x.published_total / max) * 100}%` }} />
                      <i className="held" style={{ width: `${(x.withheld_total / max) * 100}%` }} />
                    </span>
                    <span className="mbar-v">
                      <Num f={payFig(x.total, x.files)} fmt="pm1" />
                    </span>
                  </a>
                ))}
            </div>
          ))}
        </div>
        <p className="muted small">
          Gaps are quarters the council no longer lists and the Internet Archive did not keep.
          {PAY.missing.length ? ` ${PAY.missing.length} newer quarterly files are listed by the council and not yet added here.` : ""}
        </p>
      </section>

      <section id="month" aria-labelledby="month-h" className="pay-section">
        <div className="sec-head">
          <h2 id="month-h">{label}</h2>
          <p className="month-nav">
            {prev ? <a href={`/payments/${prev}`}>&larr; {formatMonth(prev)}</a> : null}
            {next ? <a href={`/payments/${next}`}>{formatMonth(next)} &rarr;</a> : null}
          </p>
        </div>
        <div className="kpis kpis-4">
          <div className="kpi">
            <span className="l">Paid out</span>
            <span className="v">
              <Num f={f(idx.total)} fmt="pm1" />
            </span>
            <span className="s">
              <Num f={f(idx.rows)} fmt="int" /> payments
            </span>
          </div>
          <div className="kpi">
            <span className="l">Named in full</span>
            <span className="v">
              <Num f={f(idx.published_total)} fmt="pm1" />
            </span>
            <span className="s">
              <Num f={f(idx.published_rows)} fmt="int" /> payments
            </span>
          </div>
          <div className="kpi">
            <span className="l">Shown only as totals</span>
            <span className="v">
              <Num f={f(idx.withheld_total)} fmt="pm1" />
            </span>
            <span className="s">
              <Num f={f(idx.withheld_rows)} fmt="int" /> payments to people
            </span>
          </div>
          <div className="kpi">
            <span className="l">Organisations paid</span>
            <span className="v">
              <Num f={f(file.suppliers.length)} fmt="int" />
            </span>
            <span className="s">this month</span>
          </div>
        </div>
        <PaymentsMonth
          file={file}
          names={names}
          groups={GROUPS.map((g) => ({ id: g.id, label: g.label }))}
          quality={PAY.meta.quality}
          groupQuality={GROUP_QUALITY}
        />
      </section>

      <section id="files" aria-labelledby="files-h" className="pay-section">
        <div className="sec-head">
          <h2 id="files-h">The council&rsquo;s files</h2>
          <p>
            Each file as the council published it, with the Internet Archive&rsquo;s copy where there is one. Every month here adds back up to its file, to the
            penny. Older files end with the council&rsquo;s own total, which matches too.
          </p>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th className="n">Payments</th>
                <th className="n">Total</th>
                <th>Fingerprint (SHA-256)</th>
              </tr>
            </thead>
            <tbody>
              {PAY.sources.map((s) => (
                <tr key={s.id}>
                  <td className="wrap-cell">
                    <a href={s.url}>{s.title}</a>
                    {s.archive_url ? (
                      <>
                        {" "}
                        <a className="small muted" href={s.archive_url}>
                          archived copy
                        </a>
                      </>
                    ) : null}
                  </td>
                  <td className="n">
                    <Num f={payFig(s.rows, [s.id])} fmt="int" />
                  </td>
                  <td className="n">
                    <Num f={payFig(s.total, [s.id])} fmt="gbp0" />
                  </td>
                  <td>
                    <code className="small" title={s.sha256}>
                      {s.sha256.slice(0, 12)}&hellip;
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {PAY.missing.length ? (
          <p className="muted small">
            Listed by the council and not yet added: {PAY.missing.map((x) => x.title).join(", ")}. The council&rsquo;s website turns away automated downloads, so
            these are added by hand.
          </p>
        ) : null}
        <p className="muted small">
          Source: <a href={PAY.meta.page}>{PAY.meta.publisher}, procurement and financial data</a>. Open Government Licence.
        </p>
      </section>

      <section id="payments-faq" aria-labelledby="payments-faq-h" className="pay-section">
        <div className="sec-head">
          <h2 id="payments-faq-h">Questions</h2>
        </div>
        <div className="faq faq-flush">
          {PAYMENTS_FAQ.map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <JsonLd data={paymentsJsonLd(PAY, month, PAYMENTS_FAQ)} />
    </PageShell>
  );
}
