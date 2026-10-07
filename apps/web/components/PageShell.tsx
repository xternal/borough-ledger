import type { PageModel } from "@/lib/model";
import { Footer } from "./Footer";
import { TopBar } from "./TopBar";

/** Top bar, independence notice and footer for pages other than the main statement. */
export function PageShell({ m, children }: { m: PageModel; children: React.ReactNode }) {
  return (
    <>
      <TopBar place={m.place.short} year={m.place.yearLabel} />
      <main className="wrap" id="top">
        <div className="kicker page-kicker">
          <span>Independent project, not run by or affiliated with {m.place.short} Council</span>
        </div>
        {children}
        <Footer council={m.place.short} hasTestData={m.hasTestData} />
      </main>
    </>
  );
}
