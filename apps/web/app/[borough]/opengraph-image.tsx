import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/ogFonts";
import { LOGO_DATA_URI } from "@/lib/logo";
import { BOROUGHS } from "@/lib/boroughs";

export const alt = "Borough Book: where your council tax goes. An independent project.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return BOROUGHS.map((b) => ({ borough: b.slug }));
}

/** Text only, like the site's own share image: the borough's name, what the page holds, and that it is independent. */
export default async function Image({ params }: { params: Promise<{ borough: string }> }) {
  const { borough } = await params;
  const b = BOROUGHS.find((x) => x.slug === borough)!;
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFFFFF", color: "#0B0B0D", padding: "72px 80px", fontFamily: "Geist" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 600 }}>
          <img src={LOGO_DATA_URI} width={36} height={36} alt="" />
          Borough Book
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.04, maxWidth: 1040 }}>{`Where your council tax goes in ${b.short}`}</div>
          <div style={{ fontSize: 30, color: "#61616B", maxWidth: 960 }}>{"Your bill, the council’s budget, council tax over the years, and every ward’s councillors."}</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#61616B" }}>{`Independent. Not run by or affiliated with the ${b.council}.`}</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 12, display: "flex" }}>
          <div style={{ width: "46%", background: "#2457F5" }} />
          <div style={{ width: "40%", background: "#52525B" }} />
          <div style={{ width: "14%", background: "#F2600C" }} />
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
