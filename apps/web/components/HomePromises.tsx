import { formatDay, formatMonthYear } from "@/lib/format";
import type { PromiseModel } from "@/lib/model";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/promises";
import { isPublished, lastChanged, spotlight } from "@/lib/spotlight";
import { sectionHref } from "@/lib/nav";
import { OPEN_THE_PROMISE } from "./PledgeRows";

/**
 * Promises close to the way in (docs/PRE_SHIP_REVIEW.md, "Promises close to the way in (19 Oct 2026)"; OpenPromises
 * decision 30): on the home page straight after the first screen and before the bill. How many promises the site tracks
 * and how many sit at each status, the latest changes and the nearest deadlines, each a direct link to its card.
 * The cards are chosen by a rule (lib/spotlight.ts), never by hand, from the cards the editor has approved; with none
 * approved the block is not drawn. Plain links: it works without JavaScript.
 */

/** The block's element id ("promises" is the home page's own Promises section further down). */
export const HOME_PROMISES_ID = "promises-now";

const PROMISES = sectionHref("promises");

/** "26 promises tracked": every card on the promises page, which is where the count leads. */
export const promisesTracked = (n: number) => `${n} ${n === 1 ? "promise" : "promises"} tracked`;

export function HomePromises({ promises, today }: { promises: readonly PromiseModel[]; today: string }) {
  if (!promises.some(isPublished)) return null;
  const { recent, due } = spotlight(promises, today);
  const counts = STATUS_ORDER.map((s) => [s, promises.filter((p) => p.status === s).length] as const).filter(([, n]) => n > 0);
  return (
    <section id={HOME_PROMISES_ID} aria-labelledby={`${HOME_PROMISES_ID}-h`} className="spot">
      <div className="spot-head">
        <h2 id={`${HOME_PROMISES_ID}-h`}>
          <a href={PROMISES}>{promisesTracked(promises.length)}</a>
        </h2>
        <ul className="spot-counts" aria-label="Where they stand">
          {counts.map(([s, n]) => (
            <li key={s}>
              <b className="num">{n}</b> <span className={`pill st-${s}`}>{STATUS_LABEL[s]}</span>
            </li>
          ))}
        </ul>
        <p className="small">One rule for every party picks the pledges below: the ones that changed last, then the open ones due soonest.</p>
      </div>
      <div className="spot-lists">
        <SpotList
          id={`${HOME_PROMISES_ID}-recent`}
          title="Latest changes"
          cards={recent}
          when={(p) => {
            const d = lastChanged(p, today);
            return d ? `Changed ${formatDay(d)}` : null;
          }}
        />
        <SpotList
          id={`${HOME_PROMISES_ID}-due`}
          title="Due next"
          cards={due}
          when={(p) => (p.deadline ? `Due ${formatMonthYear(p.deadline)}` : null)}
          none="No open promise has a deadline still to come."
        />
      </div>
      <p className="spot-all">
        <a href={PROMISES}>
          All promises <span aria-hidden="true">&rarr;</span>
        </a>
      </p>
    </section>
  );
}

/**
 * One list. Each item is one link to its card: who made it, the pledge in its own words, its status and a date, then
 * "Open the promise →". The whole item is the link, so its name is the item's words; "Open the promise →" only shows
 * that it opens, and a screen reader skips it.
 */
function SpotList({ id, title, cards, when, none }: { id: string; title: string; cards: PromiseModel[]; when: (p: PromiseModel) => string | null; none?: string }) {
  return (
    <div>
      <h3 id={id}>{title}</h3>
      {cards.length ? (
        <ul aria-labelledby={id} className="spot-list">
          {cards.map((p) => (
            <li key={p.id}>
              <a className="spot-item" href={`/promise/${p.id}`}>
                <span className="spot-who">
                  {p.party ? `${p.actor}, ${p.party}` : p.partyShort}, {p.side === "administration" ? "runs the council" : "opposition"}
                </span>{" "}
                <span className="spot-quote">&ldquo;{p.text}&rdquo;</span>{" "}
                <span className="spot-meta">
                  <span className={`pill st-${p.status}`}>{STATUS_LABEL[p.status]}</span> {when(p) ? <span>{when(p)}</span> : null}
                </span>{" "}
                <span className="spot-open" aria-hidden="true">
                  {OPEN_THE_PROMISE} &rarr;
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">{none}</p>
      )}
    </div>
  );
}
