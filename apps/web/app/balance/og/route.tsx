import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/ogFonts";
import { decodeScenario } from "@borough-ledger/engine";
import { buildModel } from "@/lib/model";
import { shareSummary } from "@/lib/shareText";

/** 1200×630 share image for a balance-it scenario: the outcome, the choices and the year after. */
export async function GET(req: Request) {
  const m = buildModel();
  const scenario = decodeScenario(m.balance.input, new URL(req.url).searchParams.get("s"));
  const sum = shareSummary(m, scenario);
  const fonts = await ogFonts();
  const short = sum.status.includes("still to find");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFFFFF", color: "#0B0B0D", padding: "64px 80px", fontFamily: "Geist" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, fontWeight: 600 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, display: "flex", overflow: "hidden" }}>
            <div style={{ width: "64%", background: "#2457F5" }} />
            <div style={{ width: "36%", background: "#A1A1AA" }} />
          </div>
          {`Borough Ledger: ${sum.title}`}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 84, fontWeight: 600, letterSpacing: "-0.03em", color: short ? "#DC2626" : "#15803D" }}>{sum.status}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 28, color: "#0B0B0D" }}>
            {sum.choices.slice(0, 4).map((c) => (
              <div key={c} style={{ display: "flex" }}>{c}</div>
            ))}
            {sum.choices.length > 4 ? <div style={{ display: "flex", color: "#61616B" }}>{`and ${sum.choices.length - 4} more`}</div> : null}
          </div>
          {sum.later ? <div style={{ display: "flex", fontSize: 26, color: "#61616B" }}>{sum.later}</div> : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#61616B", gap: 24 }}>
          <span>{`Independent. Not run by or affiliated with ${m.place.short} Council.`}</span>
          {sum.quality === "test" ? <span style={{ color: "#B45309" }}>Prototype with test data</span> : <span />}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
    },
  );
}
