import { ImageResponse } from "next/og";
import { billFor } from "@borough-ledger/engine";
import type { Band } from "@borough-ledger/schema";
import { format } from "./format";
import { LOGO_DATA_URI } from "./logo";
import type { PageModel } from "./model";
import { OG_SIZE } from "./ogCollection";
import { ogFonts } from "./ogFonts";

/**
 * Share image for the council tax options, for one band: each option's extra a week on the whole bill. Money is shown
 * only once the options are sourced (checked by a person against the report): an image cannot carry a figure's quality
 * mark, so until then it names the options without amounts.
 */
export async function optionsImage(m: PageModel, band: Band) {
  const ct = m.ctOptions!;
  const fonts = await ogFonts();
  const sourced = ct.options.every((o) => o.total.quality === "sourced");
  const now = billFor(m.rules, { council: m.bill.council.value, gla: m.bill.gla.value }, band, false).total;
  const rows = ct.options.map((o) => ({ pct: o.pct, week: (billFor(m.rules, { council: o.council.value, gla: o.gla.value }, band, false).total - now) / 52 }));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFFFFF", color: "#0B0B0D", padding: "56px 80px", fontFamily: "Geist" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontWeight: 600 }}>
            <img src={LOGO_DATA_URI} width={32} height={32} alt="" />
            Borough Book
          </div>
          <div style={{ display: "flex", color: "#61616B" }}>{`${m.place.short}, ${m.place.nextYearLabel}`}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.08 }}>{`Band ${band}: the council's three council tax options`}</div>
          {sourced ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((r) => (
                <div key={r.pct} style={{ display: "flex", fontSize: 34 }}>
                  <span style={{ width: 380, color: "#3F3F46" }}>{`Council's share +${r.pct}%`}</span>
                  <span style={{ fontWeight: 600 }}>{`+${format("gbp2", r.week)} a week`}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 30, color: "#3F3F46", lineHeight: 1.35, maxWidth: 1040 }}>
              {"The council's own share of the bill up 100%, 125% or 150%. What each would add to your whole bill, a year and a week, and how to have your say."}
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 20, color: "#61616B" }}>
          {`On the whole bill, with the Mayor of London's share. Nothing is decided. From the council's report to Cabinet, 12 October 2026. Independent: not run by or affiliated with ${m.place.short} Council.`}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
