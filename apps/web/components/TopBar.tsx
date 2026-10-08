import { SITE, STAGE } from "@/lib/site";
import { Logo } from "./Logo";
import { SectionNav, type BoroughSections } from "./SectionNav";

export function TopBar({ place, year, borough }: { place: string; year: string; borough?: BoroughSections }) {
  return (
    <header className="topbar">
      <div className="bar-in">
        <a className="mark" href="/">
          <Logo />
          {SITE.name}
          <span className="stage" title="Early version: every figure is sourced and checked by hand, and more is being added">
            {STAGE}
          </span>
        </a>
        <SectionNav borough={borough} />
        <span className="ctx">
          {place}, {year}
        </span>
      </div>
    </header>
  );
}
