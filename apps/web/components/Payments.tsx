"use client";

import { useMemo, useState } from "react";
import { formatDay } from "@/lib/format";
import type { PageModel } from "@/lib/model";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";

const PAGE = 12;

export function Payments({ payments }: Pick<PageModel, "payments">) {
  const [q, setQ] = useState("");
  const [svc, setSvc] = useState("");
  const [shown, setShown] = useState(PAGE);
  const at = (value: number) => ({ ...payments.f, value });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return payments.rows.filter((p) => (!needle || p.supplier.toLowerCase().includes(needle)) && (!svc || p.service === svc));
  }, [payments.rows, q, svc]);
  const total = rows.reduce((a, p) => a + p.amount, 0);

  return (
    <section id="payments" aria-labelledby="payments-h">
      <div className="sec-head">
        <h2 id="payments-h">Payments over £500</h2>
        <p>Every payment the council makes over £500 is published monthly. Search by supplier or service.</p>
      </div>
      <div className="pay-tools">
        <input
          type="search"
          placeholder="Search suppliers"
          aria-label="Search suppliers"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShown(PAGE);
          }}
        />
        <select
          aria-label="Filter by service"
          value={svc}
          onChange={(e) => {
            setSvc(e.target.value);
            setShown(PAGE);
          }}
        >
          <option value="">All services</option>
          {payments.services.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="pay-sum" aria-live="polite">
        <span>
          <b>{rows.length}</b> payments
        </span>
        <span>
          <b>
            <Num f={at(total)} fmt="gbp0" />
          </b>{" "}
          total
        </span>
        <span>{payments.period}</span>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Supplier</th>
              <th>Service</th>
              <th className="n">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((p, i) => (
              <tr key={`${p.date}-${p.supplier}-${i}`}>
                <td>{formatDay(p.date)}</td>
                <td>{p.supplier}</td>
                <td>{p.service}</td>
                <td className="n">
                  <Num f={at(p.amount)} fmt="gbp2" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="muted" style={{ padding: "16px 10px" }}>No payments match.</p> : null}
      </div>
      {rows.length > shown ? (
        <button type="button" className="linkbtn more" onClick={() => setShown((n) => n + PAGE)}>
          Show more
        </button>
      ) : null}
      <div className="qrow">
        <QualityGroup
          q={payments.f.quality}
          text={payments.f.quality === "test" ? "Invented payments with generic supplier names. The real feed is the council's monthly transparency file." : "From the council's monthly transparency files"}
        />
      </div>
    </section>
  );
}
