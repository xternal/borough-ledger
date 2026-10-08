import { derive } from "@borough-ledger/schema";
import { CAPITAL, SOURCE, SPAN, YEARS, capFig, fundingOf, groupsOf, pledgeLinks, totalOf, type Account } from "@/lib/capital";
import { formatDay } from "@/lib/format";
import type { PageModel } from "@/lib/model";
import { CONTACT } from "@/lib/site";
import { ChartTable, DataTable } from "./ChartTable";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";

/** A year's figure in a table: a dash where the report prints none. */
const cell = (v: number, key: string | number) => (Math.abs(v) < 0.05 ? "–" : <Num key={key} f={capFig(v)} fmt="m1" />);

/** Where an account's four-year programme goes: each area with its schemes folded underneath. */
export function CapitalGroups({ account, id, title }: { account: Account; id: string; title: string }) {
  const groups = groupsOf(account);
  const max = Math.max(...groups.map((g) => g.total));
  const total = capFig(totalOf(account).total!);
  return (
    <section aria-labelledby={id} className="pay-section">
      <div className="sec-head">
        <h2 id={id}>{title}</h2>
        <p>Open an area to see its schemes. Amounts are for the four years {SPAN}, as the council&rsquo;s report rounds them.</p>
      </div>
      <div className="cap-groups">
        {groups.map((g) => (
          <details key={`${g.section}-${g.name}`} className="cap-group">
            <summary>
              <span className="cap-l">{g.plain}</span>
              <span className="cap-v">
                <Num f={capFig(g.total)} fmt="m1" />
              </span>
              <span className="track" aria-hidden="true">
                <i style={{ width: `${((g.total / max) * 100).toFixed(1)}%` }} />
              </span>
            </summary>
            <ul className="cap-lines">
              {g.lines.map((l) => (
                <li key={l.label}>
                  <span title={l.label === l.plain ? undefined : `The council's name: ${l.label}`}>{l.plain}</span>
                  <span className="cap-v">
                    <Num f={capFig(l.total!)} fmt="m1" />
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      <ChartTable summary="Show every scheme, year by year">
        <DataTable
          caption={`Building work by scheme, ${SPAN}, £m`}
          head={["", ...YEARS, "Total"]}
          rows={groups.flatMap((g) => [
            { key: `g-${g.section}-${g.name}`, group: g.plain },
            ...g.lines.map((l) => ({
              key: `${g.section}-${l.label}`,
              cells: [l.plain, ...l.years.map((v, i) => cell(v, i)), <Num key="t" f={capFig(l.total!)} fmt="m1" />],
            })),
          ])}
          foot={["All schemes, as the report totals them", ...totalOf(account).years.map((v, i) => <Num key={i} f={capFig(v)} fmt="m1" />), <Num key="t" f={total} fmt="m1" />]}
        />
      </ChartTable>
    </section>
  );
}

/** How an account's programme is paid for, and the debt it leaves. */
export function CapitalFunding({ account, id }: { account: Account; id: string }) {
  const funding = fundingOf(account);
  const all = totalOf(account).total!;
  const max = Math.max(...funding.map((f) => f.total));
  const debt = CAPITAL.debt[account];
  const end = debt.years[debt.years.length - 1]!;
  return (
    <section aria-labelledby={id} className="pay-section">
      <div className="sec-head">
        <h2 id={id}>How it is paid for</h2>
      </div>
      <div className="rows">
        {funding.map((f) => (
          <div className="row" key={f.label}>
            <span title={f.label === f.plain ? undefined : `The council's term: ${f.label}`}>
              {f.plain}
              {f.desc ? <span className="small muted block">{f.desc}</span> : null}
            </span>
            <span className="v">
              <Num f={capFig(f.total)} fmt="m1" />
            </span>
            <div className="track" aria-hidden="true">
              <i style={{ width: `${((f.total / max) * 100).toFixed(1)}%` }} />
            </div>
          </div>
        ))}
      </div>
      {Math.abs(funding.reduce((a, f) => a + f.total, 0) - all) >= 0.05 ? (
        <p className="small muted" style={{ marginTop: 12 }}>
          The report rounds every figure, so these add up to <Num f={capFig(funding.reduce((a, f) => a + f.total, 0))} fmt="m1" /> against the{" "}
          <Num f={capFig(all)} fmt="m1" /> of work.
        </p>
      ) : null}
      <p style={{ marginTop: 16 }}>
        {debt.plain}: <Num f={capFig(debt.opening)} fmt="m1" /> at the start of {YEARS[0]}, and <Num f={capFig(end)} fmt="m1" /> forecast at the end of{" "}
        {YEARS[YEARS.length - 1]} ({end < debt.opening ? "down" : "up"} <Num f={derive(Math.abs(end - debt.opening), capFig(end), capFig(debt.opening))} fmt="m1" />
        ). The council calls this its capital financing requirement.
      </p>
      <ChartTable summary="Show the funding and debt year by year">
        <DataTable
          caption={`How the work is paid for, ${SPAN}, £m`}
          head={["", ...YEARS, "Total"]}
          rows={funding.map((f) => ({
            key: f.label,
            cells: [f.plain, ...f.years.map((v, i) => cell(v, i)), <Num key="t" f={capFig(f.total)} fmt="m1" />],
          }))}
        />
        <DataTable
          caption={`${debt.plain}, £m`}
          head={["", ...YEARS]}
          rows={[{ key: "debt", cells: ["End of year", ...debt.years.map((v, i) => <Num key={i} f={capFig(v)} fmt="m1" />)] }]}
        />
      </ChartTable>
    </section>
  );
}

/** Pledges a scheme pays towards. A link only where the scheme is what the pledge names, for any party. */
export function CapitalPledges({ account, m }: { account: Account; m: PageModel }) {
  const links = pledgeLinks(account, m);
  if (!links.length) return null;
  return (
    <section aria-labelledby={`pledges-${account}-h`} className="pay-section">
      <div className="sec-head">
        <h2 id={`pledges-${account}-h`}>Pledges these schemes pay towards</h2>
        <p>Where a scheme is what a manifesto pledge names. Whether the pledge is kept is judged on its card.</p>
      </div>
      <ul className="cap-pledges">
        {links.map(({ line, promises }) => (
          <li key={line.label}>
            <b>{line.plain}</b>, <Num f={capFig(line.total!)} fmt="m1" />
            {promises.map((p) => (
              <span key={p.id} className="block">
                <a href={`/promise/${p.id}`}>
                  {p.partyShort} pledge: &ldquo;{p.text}&rdquo;
                </a>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Where the figures come from, what does not add up in the council's own papers, and how sure we are. */
export function CapitalNotes({ resolutionUrl }: { resolutionUrl: string }) {
  const r = CAPITAL.resolution;
  return (
    <section aria-labelledby="cap-notes-h" className="pay-section">
      <div className="sec-head">
        <h2 id="cap-notes-h">About these figures</h2>
      </div>
      <p>
        Full Council <a href={resolutionUrl}>resolved</a> on {formatDay(SOURCE.published_on!)} to approve <Num f={capFig(r.gf_m)} fmt="m1" /> of building work
        and <Num f={capFig(r.hra_m)} fmt="m1" /> for council homes. The report&rsquo;s own tables add up to <Num f={capFig(totalOf("gf").total!)} fmt="m1" /> and{" "}
        <Num f={capFig(totalOf("hra").total!)} fmt="m1" />, <Num f={capFig(r.gf_gap_m)} fmt="m1" /> and <Num f={capFig(r.hra_gap_m)} fmt="m1" /> less. This
        page shows the tables, because they name every scheme. If you know why the two differ, tell us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
      {CAPITAL.misprints.map((x) => (
        <p key={x.label} className="small muted">
          A misprint in the report, on PDF page {x.page}: in the funding of &ldquo;{x.section.toLowerCase()}&rdquo;, the line &ldquo;{x.label}&rdquo; has {x.note}.
          We use <Num f={capFig(x.used)} fmt="m1" />.
        </p>
      ))}
      <div className="qrow">
        <QualityGroup q={CAPITAL.quality} text={CAPITAL.quality === "sourced" ? "Checked line by line against the report" : "Copied from the report and checked against its own totals; awaiting a second person's check"} />
      </div>
      <p className="small muted">
        From <a href={SOURCE.url}>{SOURCE.title}</a>: Table 1 (PDF page 17), Tables 2 to 5 (pages 18 and 19) and Appendix 1 (pages 24 to 28).
      </p>
    </section>
  );
}
