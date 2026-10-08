import { ALLOW_TEST_DATA } from "@/lib/quality";
import { CONTACT, MAKER, REPO } from "@/lib/site";

export function Footer({ council, hasTestData }: { council: string; hasTestData: boolean }) {
  return (
    <footer>
      <span>Borough Book is an independent project. It is not run by, endorsed by or affiliated with {council} Council.</span>
      <span>
        Spotted a mistake, or named on a card? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. The code and data are <a href={REPO}>open on GitHub</a>. <a href="/follow">Follow changes by RSS</a>.
      </span>
      {hasTestData && ALLOW_TEST_DATA ? <span>Prototype for design review. Do not quote any figure marked test.</span> : null}
      <span className="credit">
        <a href={MAKER.url}>Made by {MAKER.name}</a>
        <a href={MAKER.coffee}>Buy me a coffee</a>
      </span>
    </footer>
  );
}
