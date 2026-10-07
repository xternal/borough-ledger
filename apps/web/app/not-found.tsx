import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { buildModel } from "@/lib/model";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: `Page not found | ${SITE.name}`, robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <PageShell m={buildModel()}>
      <div className="hero">
        <h1>Page not found</h1>
        <p className="lede">
          There is nothing at this address. Start from <a href="/">your council tax bill and the budget</a>, the <a href="/promises">promises</a> or the{" "}
          <a href="/payments">payments over £500</a>.
        </p>
      </div>
    </PageShell>
  );
}
