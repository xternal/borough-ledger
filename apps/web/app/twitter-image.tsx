import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/ogFonts";
import { DATA } from "@borough-ledger/schema";
import { ALLOW_TEST_DATA } from "@/lib/quality";

export const alt = "Borough Ledger: where your council tax goes. An independent project.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Text only: no figures, so the share image can never carry an unmarked test value. */
export default async function Image() {
  const fonts = await ogFonts();
  const place = DATA.council.meta.council_short;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFFFFF", color: "#0B0B0D", padding: "72px 80px", fontFamily: "Geist" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 600 }}>
          <div style={{ width: 30, height: 30, borderRadius: 6, display: "flex", overflow: "hidden" }}>
            <div style={{ width: "64%", background: "#2457F5" }} />
            <div style={{ width: "36%", background: "#A1A1AA" }} />
          </div>
          Borough Ledger
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.04, maxWidth: 1040 }}>{`Where your council tax goes in ${place}`}</div>
          <div style={{ fontSize: 30, color: "#61616B", maxWidth: 960 }}>{"Your bill, the council\u2019s budget, how the gap was closed, and every promise, costed."}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22, color: "#61616B", gap: 24 }}>
          <span>{`Independent. Not run by or affiliated with ${place} Council.`}</span>
          {ALLOW_TEST_DATA ? <span style={{ color: "#B45309" }}>Prototype with test data</span> : <span />}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 12, display: "flex" }}>
          <div style={{ width: "46%", background: "#2457F5" }} />
          <div style={{ width: "40%", background: "#52525B" }} />
          <div style={{ width: "14%", background: "#F2600C" }} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}
