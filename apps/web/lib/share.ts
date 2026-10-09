/* Share cards. Next.js drops a parent's Open Graph image when a page sets its own Open Graph fields, so every page names
   its address and an image here: its own where it has one, otherwise the site's (app/opengraph-image.tsx). */

/** The site's own share image, for pages with none of their own. */
export const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "Borough Book: where your council tax goes. An independent project." } as const;

/** og:url and the image for one page; spread into its metadata. `own`: the page's segment has its own share image file
 *  (opengraph-image.tsx), which Next.js adds itself. */
export function share(path: string, title: string, description: string, opts: { own?: boolean; image?: { url: string; alt: string }; og?: Record<string, unknown> } = {}) {
  const image = opts.image ? { url: opts.image.url, width: 1200, height: 630, alt: opts.image.alt } : opts.own ? null : SHARE_IMAGE;
  return {
    openGraph: { ...opts.og, title, description, url: path, ...(image ? { images: [image] } : {}) },
    twitter: { card: "summary_large_image" as const, title, description, ...(image ? { images: [image.url] } : {}) },
  };
}
