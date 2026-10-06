import type { PageModel } from "@/lib/model";
import { faq } from "@/lib/faq";
import { Num } from "./Num";

export function Method({ m }: { m: PageModel }) {
  return (
    <section id="method" aria-labelledby="method-h">
      <div className="sec-head">
        <h2 id="method-h">How this works</h2>
      </div>
      <div className="method">
        <div>
          <h3>The rules a council lives by</h3>
          <ul>
            <li>It must set a balanced budget every year.</li>
            <li>It can borrow only for buildings and other capital, not for running costs.</li>
            <li>
              A council tax rise above <Num f={m.referendumLimitNow} fmt="pct2" /> needs a local referendum.
            </li>
          </ul>
        </div>
        <div>
          <h3>Every number is labelled</h3>
          <ul>
            <li>
              <span className="q sourced">sourced</span> from a published document, linked below.
            </li>
            <li>
              <span className="q approx">approx</span> from a secondary source or an assumption still to be checked.
            </li>
            <li>
              <span className="q test">test</span> invented to show the layout, underlined in red. Replaced by real data before launch.
            </li>
          </ul>
        </div>
        <div>
          <h3>Sources</h3>
          <ul>
            {m.sources.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="faq">
        <h3>Questions</h3>
        {faq(m.place.short).map(({ q, a }) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
