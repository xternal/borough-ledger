import { FAMILY, THIS_SITE } from "@/lib/family";
import { MAKER } from "@/lib/site";

/**
 * The family of sites, behind a small button beside the logo: every ledger on the same open engine, and the maker's
 * site. A <details> element, so it opens without JavaScript and keeps its place for keyboards and screen readers.
 */
export function FamilySwitcher() {
  return (
    <details className="family">
      <summary aria-label="The other sites of the family">
        <svg aria-hidden="true" viewBox="0 0 14 14" width="14" height="14">
          <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="family-panel">
        <p>Public money and promises, one ledger per country or place, on the same open engine.</p>
        <ul>
          {FAMILY.map((s) => {
            const here = s.name === THIS_SITE;
            return (
              <li key={s.name}>
                <a href={s.href} aria-current={here ? "page" : undefined}>
                  <b>
                    {s.name}
                    {here ? <span className="family-here">you are here</span> : null}
                  </b>
                  <span>{s.about}</span>
                </a>
              </li>
            );
          })}
        </ul>
        <a className="family-maker" href={MAKER.url}>
          Made by {MAKER.name}, guzh.uk
        </a>
      </div>
    </details>
  );
}
