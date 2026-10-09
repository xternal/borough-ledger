import { ALLOW_TEST_DATA } from "@/lib/quality";
import { CONTACT, MAKER, REPO } from "@/lib/site";
import { HOME_BOROUGH, OTHER_BOROUGHS } from "@/lib/boroughList";

/** `full` is the council's own name where "<place> Council" would be wrong, such as a royal borough. */
export function Footer({ council, hasTestData, full }: { council: string; hasTestData: boolean; full?: string }) {
  return (
    <footer>
      <span>Borough Book is an independent project. It is not run by, endorsed by or affiliated with {full ?? `${council} Council`}.</span>
      <span>
        Spotted a mistake, or named on a card? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. The code and data are <a href={REPO}>open on GitHub</a>. <a href="/follow">Follow changes by RSS</a>.
      </span>
      <span>
        Boroughs:{" "}
        {[HOME_BOROUGH, ...OTHER_BOROUGHS].map((b, i) => (
          <span key={b.href}>
            {i ? ", " : ""}
            <a href={b.href}>{b.short}</a>
          </span>
        ))}
        .
      </span>
      {hasTestData && ALLOW_TEST_DATA ? <span>Prototype for design review. Do not quote any figure marked test.</span> : null}
      <span className="credit">
        <a href={MAKER.url}>Made by {MAKER.name}</a>
        <a href={MAKER.coffee}>Buy me a coffee</a>
      </span>
    </footer>
  );
}
