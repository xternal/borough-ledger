import type { Figure } from "@borough-ledger/schema";
import type { PageModel, SavingRow } from "@/lib/model";
import { Num } from "./Num";

function Rows({ rows, nextYear }: { rows: SavingRow[]; nextYear: string }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Saving</th>
          <th>Service</th>
          <th className="n">This year</th>
          <th className="n">{nextYear}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="wrap-cell">
              {r.label}
              {r.oneOff ? <span className="oneoff">one-off</span> : null}
            </td>
            <td className="wrap-cell muted">{r.service}</td>
            <td className="n">
              <Num f={r.f} fmt="mAuto" />
            </td>
            <td className="n">
              <Num f={r.next} fmt="mAuto" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Group({ title, total, rows, nextYear, note }: { title: string; total: Figure; rows: SavingRow[]; nextYear: string; note?: string }) {
  return (
    <div className="savings-group">
      <h3>
        {title}: <Num f={total} fmt="m1" />
      </h3>
      {note ? <p className="small muted">{note}</p> : null}
      <div className="tablewrap">
        <Rows rows={rows} nextYear={nextYear} />
      </div>
    </div>
  );
}

/** Every named saving in this year's budget (Appendix C), under the waterfall. */
export function SavingsList({ savings, place }: Pick<PageModel, "savings" | "place">) {
  const { service, collection, serviceTotal, collectionTotal, oneOffTotal } = savings;
  if (!serviceTotal) return null;
  return (
    <details className="savings">
      <summary>
        The <Num f={serviceTotal} fmt="m1" /> of savings, line by line
      </summary>
      {oneOffTotal ? (
        <p className="small muted">
          <Num f={oneOffTotal} fmt="m1" /> of this year&rsquo;s savings are one-off. They save nothing in {place.nextYearLabel}, so the same amount comes back
          as part of next year&rsquo;s gap.
        </p>
      ) : null}
      <Group title="Service savings" total={serviceTotal} rows={service} nextYear={place.nextYearLabel} />
      {collectionTotal ? (
        <Group
          title="Collection fund savings"
          total={collectionTotal}
          rows={collection}
          nextYear={place.nextYearLabel}
          note="More council tax and business rates collected, and provisions released. These sit in the funding lines above, not in the savings line."
        />
      ) : null}
    </details>
  );
}
