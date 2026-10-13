/* Reading a pledge's source over the network: a PDF page by page, a web page as a reader sees it. Used by the CLIs only. */
import { textOfHtml } from "./promise-quotes";

export type SourceText = { pages: string[]; bytes: Uint8Array } | { picture: string } | { error: string };

/** One string per PDF page, with line ends kept so a word split over two lines can be joined back. */
export async function pdfPages(data: Uint8Array): Promise<string[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf.js takes ownership of the buffer it is given; hand it a copy so the caller keeps the original bytes.
  const doc = await getDocument({ data: data.slice(), useSystemFonts: true, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const { items } = await (await doc.getPage(i)).getTextContent();
    pages.push(items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : "")).join(""));
  }
  return pages;
}

/** The source's text; a picture (a leaflet's photo) for an editor to read; or why it could not be read. Three tries. */
export async function readSource(url: string): Promise<SourceText> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "BoroughBook.UK quote check (https://boroughbook.uk)" }, redirect: "follow", signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const type = res.headers.get("content-type") ?? "";
      if (type.includes("pdf") || String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-") return { pages: await pdfPages(bytes), bytes };
      if (type.includes("html") || type.includes("text")) return { pages: [textOfHtml(new TextDecoder().decode(bytes))], bytes };
      if (type.startsWith("image/")) return { picture: type };
      return { error: `not text or a picture (${type || "unknown type"})` };
    } catch (e) {
      if (attempt === 3) return { error: (e as Error).message };
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return { error: "unreachable" };
}
