import { ImageResponse } from "next/og";
import { DECODER, type DecodedCouncil, type PartId } from "./decoder";
import { format } from "./format";
import { LOGO_DATA_URI } from "./logo";
import { OG_SIZE } from "./ogCollection";
import { ogFonts } from "./ogFonts";
import { assertRenderable } from "./quality";

/** The parts' colours in the share image (light only, like every share image): the site's own blue, grey and orange. */
const COLOUR: Record<PartId, string> = { council: "#2457F5", county: "#52525B", police: "#9DB4FA", fire: "#F2600C", combined: "#F7AE85", parish: "#A1A1AA" };

const frame = (kicker: string, body: React.ReactNode, foot: string) => (
  <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFFFFF", color: "#0B0B0D", padding: "56px 80px", fontFamily: "Geist" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontWeight: 600 }}>
        <img src={LOGO_DATA_URI} width={32} height={32} alt="" />
        BoroughBook.UK
      </div>
      <div style={{ display: "flex", color: "#61616B" }}>{kicker}</div>
    </div>
    {body}
    <div style={{ display: "flex", fontSize: 20, color: "#61616B" }}>{foot}</div>
  </div>
);

/** One council's Band D bill: the total, the change, and who gets it, as a bar with the largest parts named. Every figure
    here is sourced (the government's tables); an image cannot carry a quality mark, so the build stops if one is not. */
export async function decodedImage(c: DecodedCouncil) {
  assertRenderable(c.total.quality, "decoder share image");
  if (c.total.quality !== "sourced") throw new Error("decoder share image: figures must be sourced to appear without a mark");
  const fonts = await ogFonts();
  const shown = c.parts.filter((p) => p.f.value > 0);
  const named = [...shown].sort((a, z) => z.f.value - a.f.value).slice(0, 4);
  return new ImageResponse(
    frame(
      `Council tax, ${DECODER.yearLabel}`,
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: c.name.length > 24 ? 50 : 60, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.08 }}>{`Where a Band D bill in ${c.place} goes`}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
          <span style={{ fontSize: 56, fontWeight: 600 }}>{format("gbp2", c.total.value)}</span>
          <span style={{ fontSize: 30, color: "#3F3F46" }}>{`${c.change.value >= 0 ? "up" : "down"} ${format("gbp2", Math.abs(c.change.value))} on last year`}</span>
        </div>
        <div style={{ display: "flex", width: "100%", height: 34, borderRadius: 8, overflow: "hidden" }}>
          {shown.map((p) => (
            <div key={p.id} style={{ display: "flex", width: `${(p.share.value * 100).toFixed(2)}%`, background: COLOUR[p.id] }} />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px", fontSize: 24 }}>
          {named.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", width: 18, height: 18, borderRadius: 4, background: COLOUR[p.id] }} />
              <span style={{ color: "#3F3F46" }}>{p.body.length > 38 ? `${p.body.slice(0, 36)}…` : p.body}</span>
              <span style={{ fontWeight: 600 }}>{format("gbp2", p.f.value)}</span>
            </div>
          ))}
        </div>
      </div>,
      `Average Band D, two adults. From the government's council tax tables. Independent: not run by or affiliated with any council.`,
    ),
    { ...OG_SIZE, fonts },
  );
}

/** The decoder's own share image: what it does, in words. */
export async function decoderImage() {
  const fonts = await ogFonts();
  return new ImageResponse(
    frame(
      `England, ${DECODER.yearLabel}`,
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.05 }}>Your council tax, decoded</div>
        <div style={{ display: "flex", fontSize: 32, color: "#3F3F46", lineHeight: 1.35, maxWidth: 1040 }}>
          {`Put in your postcode: see how much your council keeps, and how much goes to the county or the Mayor, police, fire and parish councils. All ${DECODER.count} councils in England.`}
        </div>
      </div>,
      "From the government's council tax tables. Independent: not run by or affiliated with any council.",
    ),
    { ...OG_SIZE, fonts },
  );
}
