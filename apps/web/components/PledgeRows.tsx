import { formatMonthYear } from "@/lib/format";
import type { PromiseModel } from "@/lib/model";
import { STATUS_LABEL } from "@/lib/promises";
import { Num, TestMark } from "./Num";

/** What every promise link ends with (decision 30): one click opens the card. */
export const OPEN_THE_PROMISE = "Open the promise";

/**
 * One pledge as a row, and the row is one link straight to its card page (decision 30). Its name for a screen reader
 * is the row's own words; "Open the promise →" only shows that it opens, so a screen reader skips it.
 */
export function PromiseRow({
  p,
  lead = "party",
  area = false,
  check = false,
}: {
  p: PromiseModel;
  /** What the row starts with: who made it, or the topic (on a party's page). */
  lead?: "party" | "area";
  /** Also name the topic among the details. */
  area?: boolean;
  /** Mark a card that awaits the editor's check. */
  check?: boolean;
}) {
  return (
    <a className="prow" href={`/promise/${p.id}`}>
      <span className="prow-who">
        <b>{lead === "party" ? (p.party ? `${p.actor}, ${p.party}` : p.partyShort) : p.area}</b>
        {lead === "party" ? <span className="muted">{p.side === "administration" ? "runs the council" : "opposition"}</span> : null}
      </span>
      <span className="prow-quote">&ldquo;{p.text}&rdquo;</span>
      <span className="prow-meta">
        <span className={`pill st-${p.status}`}>{STATUS_LABEL[p.status]}</span>
        {area ? <span>{p.area}</span> : null}
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
        {check && p.editorCheck ? <span className="checkmark">Awaiting editor check</span> : null}
        {p.test ? <TestMark what={`promise card ${p.id}`}>Test card</TestMark> : null}
      </span>
      <span className="prow-open" aria-hidden="true">
        {OPEN_THE_PROMISE} &rarr;
      </span>
    </a>
  );
}

/** Pledges as rows, each opening its card: the same look as /promises, for the party and topic pages. */
export function PledgeRows({ promises, show }: { promises: PromiseModel[]; show: "party" | "area" }) {
  return (
    <ol className="prows">
      {promises.map((p) => (
        <li key={p.id}>
          <PromiseRow p={p} lead={show} />
        </li>
      ))}
    </ol>
  );
}
