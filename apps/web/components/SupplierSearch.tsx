"use client";

import { useEffect, useMemo, useState } from "react";
import type { Quality } from "@borough-ledger/schema";
import { Num } from "./Num";

/** [id, name, total paid, has a page] for every organisation in the ledger, from /payments/suppliers.json. */
type Entry = [string, string, number, boolean];

/** Search every organisation the council has paid, across all months. The list loads when you start typing. */
export function SupplierSearch({ quality, files }: { quality: Quality; files: string[] }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!q || all || failed) return;
    fetch("/payments/suppliers.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Entry[]) => setAll(d))
      .catch(() => setFailed(true));
  }, [q, all, failed]);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || !all) return [];
    return all.filter((e) => e[1].toLowerCase().includes(needle)).slice(0, 20);
  }, [q, all]);

  return (
    <div className="supplier-search">
      <div className="pay-tools">
        <input type="search" placeholder="Search every organisation paid, e.g. Veolia" aria-label="Search organisations" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {q && !all && !failed ? <p className="muted small">Loading the list of organisations&hellip;</p> : null}
      {failed ? <p className="muted small">The list of organisations did not load. Try again later.</p> : null}
      {q && all ? (
        hits.length ? (
          <ul className="supplier-hits">
            {hits.map(([id, name, total, page]) => (
              <li key={id}>
                {page ? <a href={`/supplier/${id}`}>{name}</a> : <span>{name}</span>}
                <span className="muted">
                  <Num f={{ value: total, quality, sources: files }} fmt="gbp0" /> in all
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">No organisation matches.</p>
        )
      ) : null}
    </div>
  );
}
