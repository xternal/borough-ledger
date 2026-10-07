"use client";

import { useMemo, useState } from "react";
import type { PaymentsMonthFile, Quality } from "@borough-ledger/schema";
import { formatDay } from "@/lib/format";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";

const PAGE = 50;
const REASON: Record<string, string> = {
  redacted: "Name redacted by the council",
  person: "Paid to someone who looks like a private individual",
};

type Sort = "amount" | "newest" | "oldest";

/** One month of payments: search, filter by service, sort. Everything stays in the browser. */
export function PaymentsMonth({
  file,
  names,
  groups,
  quality,
  groupQuality,
}: {
  file: PaymentsMonthFile;
  /** Name and whether a supplier page exists, aligned with file.suppliers. */
  names: [string, boolean][];
  groups: { id: string; label: string }[];
  quality: Quality;
  groupQuality: Quality;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [sort, setSort] = useState<Sort>("amount");
  const [shown, setShown] = useState(PAGE);
  const label = useMemo(() => new Map(groups.map((g) => [g.id, g.label])), [groups]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = file.rows.filter((r) => {
      if (group && r[3] !== group) return false;
      if (!needle) return true;
      return [names[r[1]]![0], file.areas[r[4]], file.types[r[5]], r[6]].some((t) => t?.toLowerCase().includes(needle));
    });
    if (sort === "amount") out.sort((a, z) => z[2] - a[2]);
    if (sort === "newest") out.sort((a, z) => z[0].localeCompare(a[0]) || z[2] - a[2]);
    if (sort === "oldest") out.sort((a, z) => a[0].localeCompare(z[0]) || z[2] - a[2]);
    return out;
  }, [file, names, q, group, sort]);
  const total = rows.reduce((a, r) => a + r[2], 0);
  const fig = (value: number, files: readonly string[] = file.files) => ({ value, quality, sources: [...files] });
  const reset = () => setShown(PAGE);

  return (
    <>
      <div className="pay-tools">
        <input
          type="search"
          placeholder="Search organisation, service or what it was for"
          aria-label="Search this month's payments"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            reset();
          }}
        />
        <select
          aria-label="Filter by service"
          value={group}
          onChange={(e) => {
            setGroup(e.target.value);
            reset();
          }}
        >
          <option value="">All services</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="amount">Largest first</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
      <div className="pay-sum" aria-live="polite">
        <span>
          <b>
            <Num f={fig(rows.length)} fmt="int" />
          </b>{" "}
          payments
        </span>
        <span>
          <b>
            <Num f={fig(total)} fmt="gbp0" />
          </b>{" "}
          total
        </span>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Paid to</th>
              <th>Service</th>
              <th>What for</th>
              <th className="n">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((r) => {
              const [name, page] = names[r[1]]!;
              const supplierId = file.suppliers[r[1]]!;
              return (
                <tr key={`${r[7]}-${r[8]}`}>
                  <td>{formatDay(r[0])}</td>
                  <td className="wrap-cell">{page ? <a href={`/supplier/${supplierId}`}>{name}</a> : name}</td>
                  <td className="wrap-cell">
                    {label.get(r[3]) ?? r[3]}
                    <span className="small muted block">{file.areas[r[4]]}</span>
                  </td>
                  <td className="wrap-cell">{file.types[r[5]]}</td>
                  <td className="n">
                    <Num f={fig(r[2], [file.files[r[7]]!])} fmt="gbp2" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="muted" style={{ padding: "16px 10px" }}>No payments match.</p> : null}
      </div>
      {rows.length > shown ? (
        <button type="button" className="linkbtn more" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, rows.length - shown)} more of {rows.length - shown}
        </button>
      ) : null}

      {file.withheld.length ? (
        <>
          <h3 className="pay-h3">Shown only as totals</h3>
          <p className="muted small">
            The council redacts payments to people, such as care paid directly to residents or foster carers. We also hold back any payment to someone who
            looks like a private individual. Only the totals per service are shown, and nobody is named.
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Why</th>
                  <th className="n">Payments</th>
                  <th className="n">Total</th>
                </tr>
              </thead>
              <tbody>
                {file.withheld
                  .filter((w) => !group || w.group === group)
                  .map((w) => (
                    <tr key={`${w.group}-${w.reason}`}>
                      <td className="wrap-cell">{label.get(w.group) ?? w.group}</td>
                      <td className="wrap-cell">{REASON[w.reason]}</td>
                      <td className="n">
                        <Num f={fig(w.rows)} fmt="int" />
                      </td>
                      <td className="n">
                        <Num f={fig(w.total)} fmt="gbp0" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <div className="qrow">
        <QualityGroup q={quality} text="Amounts: the council's own figures, excluding VAT" />
        <QualityGroup
          q={groupQuality}
          text={groupQuality === "sourced" ? "Services: matched from the council's service areas and checked by hand" : "Services: matched by us from the council's service areas, before a check by hand"}
        />
      </div>
    </>
  );
}
