import { ImageResponse } from "next/og";
import { LOGO_DATA_URI } from "./logo";
import { ogFonts } from "./ogFonts";

export const OG_SIZE = { width: 1200, height: 630 };

/** Share image for a page that groups pledges (a party, a topic): a heading, one line of where they stand, and the
 *  pledge statuses as pills. Text only: counts, never money, so it can never carry an unmarked figure. */
export async function collectionImage({ kicker, title, line, pills, place }: { kicker: string; title: string; line: string; pills: string[]; place: string }) {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFFFFF", color: "#0B0B0D", padding: "60px 80px", fontFamily: "Geist" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontWeight: 600 }}>
            <img src={LOGO_DATA_URI} width={32} height={32} alt="" />
            Borough Book
          </div>
          <div style={{ display: "flex", color: "#61616B" }}>{kicker}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontSize: title.length > 60 ? 54 : 64, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 28, color: "#3F3F46", lineHeight: 1.35, maxWidth: 1040 }}>{line}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {pills.map((p) => (
              <div key={p} style={{ display: "flex", padding: "6px 16px", borderRadius: 999, background: "#F5F5F6", fontSize: 24, fontWeight: 600 }}>
                {p}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 20, color: "#61616B" }}>{`Independent. Not run by or affiliated with ${place} Council.`}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}

/** "2 Delivering", "5 Promised": the statuses in a group of pledges, in ladder order. */
export function statusPills(statuses: string[], label: (s: string) => string, order: readonly string[]): string[] {
  return order.filter((s) => statuses.includes(s)).map((s) => `${statuses.filter((x) => x === s).length} ${label(s)}`);
}
