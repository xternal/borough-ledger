import { HOME_BOROUGH, OTHER_BOROUGHS } from "@/lib/boroughList";
import { BoroughPicker } from "./BoroughPicker";

/** The first line of a borough's page: which borough, a way to switch, and that the project is not the council. */
export function HeroTop({ current, council, children }: { current: string; council: string; children?: React.ReactNode }) {
  return (
    <div className="hero-top">
      <BoroughPicker current={current} boroughs={[HOME_BOROUGH, ...OTHER_BOROUGHS]} />
      <span className="indep">Independent. Not run by or affiliated with {council}.</span>
      {children}
    </div>
  );
}
