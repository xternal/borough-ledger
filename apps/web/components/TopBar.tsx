import { SITE, STAGE } from "@/lib/site";
import { FamilySwitcher } from "./FamilySwitcher";
import { Logo } from "./Logo";
import { SectionNav, type BoroughSections } from "./SectionNav";

/**
 * The one header, on every page: the logo with the family switcher, the menu with the page's item highlighted (its
 * sub-pages too), and Follow. One row, 48px, so the page starts high on the screen.
 */
export function TopBar({ place, year, borough }: { place: string; year: string; borough?: BoroughSections }) {
  return (
    <header className="topbar">
      <div className="bar-in">
        <div className="mark-wrap">
          <a className="mark" href="/">
            <Logo />
            {SITE.name}
            <span className="stage" title="Early version: every figure is sourced and checked by hand, and more is being added">
              {STAGE}
            </span>
          </a>
          <FamilySwitcher />
        </div>
        <SectionNav borough={borough} />
        <span className="ctx">
          {place}, {year}
        </span>
        <a className="bar-follow" href="/follow">
          Follow
        </a>
      </div>
    </header>
  );
}
