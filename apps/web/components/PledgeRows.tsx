import { formatMonthYear } from "@/lib/format";
import type { PromiseModel } from "@/lib/model";
import { STATUS_LABEL } from "@/lib/promises";
import { Num } from "./Num";

/** Pledges as rows, each opening its card: the same look as /promises, for the party and topic pages. */
export function PledgeRows({ promises, show }: { promises: PromiseModel[]; show: "party" | "area" }) {
  return (
    <ol className="prows">
      {promises.map((p) => (
        <li key={p.id}>
          <a className="prow" href={`/promise/${p.id}`}>
            <span className="prow-who">
              <b>{show === "party" ? p.partyShort : p.area}</b>
              {show === "party" ? <span className="muted">{p.side === "administration" ? "runs the council" : "opposition"}</span> : null}
            </span>
            <span className="prow-quote">&ldquo;{p.text}&rdquo;</span>
            <span className="prow-meta">
              <span className={`pill st-${p.status}`}>{STATUS_LABEL[p.status]}</span>
              <span>
                {p.cost ? (
                  <>
                    <Num f={p.cost.low} fmt="m1" />
                    {" to "}
                    <Num f={p.cost.high} fmt="m1" /> a year
                  </>
                ) : p.capital ? (
                  <>
                    <Num f={p.capital.central} fmt="m1" /> to build, once
                  </>
                ) : (
                  "No cost stated"
                )}
              </span>
              {p.deadline ? <span>Due {formatMonthYear(p.deadline)}</span> : null}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}
