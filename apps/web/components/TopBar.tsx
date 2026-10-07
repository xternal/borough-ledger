import { STAGE } from "@/lib/site";
import { SectionNav } from "./SectionNav";

export function TopBar({ place, year }: { place: string; year: string }) {
  return (
    <header className="topbar">
      <div className="bar-in">
        <a className="mark" href="/">
          <i aria-hidden="true" />
          Borough Ledger
          <span className="stage" title="Early version: figures are sourced, but editors are still checking promise cards and service groups">
            {STAGE}
          </span>
        </a>
        <SectionNav />
        <span className="ctx">
          {place}, {year}
        </span>
      </div>
    </header>
  );
}
