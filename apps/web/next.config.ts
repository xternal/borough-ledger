import type { NextConfig } from "next";

/**
 * The production address on Vercel before the site had its own domain. Once NEXT_PUBLIC_SITE_URL names another host
 * (the site's own domain), every request to the old address is sent there permanently, path and all. Until then, and
 * on previews where it is unset, nothing is redirected: one setting moves canonical links, the sitemap, feeds and the
 * redirect together.
 */
const OLD_HOST = "borough-ledger.vercel.app";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
const MOVED = SITE_URL && new URL(SITE_URL).host !== OLD_HOST ? SITE_URL : null;

const config: NextConfig = {
  transpilePackages: ["@borough-ledger/schema", "@borough-ledger/engine"],
  reactStrictMode: true,
  poweredByHeader: false,
  // Old addresses keep working: the Vercel address once the site has its own domain, and /councillors (now /wards, M6).
  async redirects() {
    return [
      ...(MOVED ? [{ source: "/:path*", has: [{ type: "host" as const, value: OLD_HOST }], destination: `${MOVED}/:path*`, permanent: true }] : []),
      { source: "/councillors", destination: "/wards", permanent: true },
    ];
  },
  // Each pledge as Markdown at /promise/<id>.md, next to its page (llmstxt.org).
  async rewrites() {
    return [{ source: "/promise/:id.md", destination: "/md/promise/:id" }];
  },
  // Share images rendered on request read their fonts from disk; make sure the files ship with them (lib/ogFonts.ts).
  outputFileTracingIncludes: {
    "/balance/og": ["./assets/fonts/*.ttf"],
    "/opengraph-image": ["./assets/fonts/*.ttf"],
    "/twitter-image": ["./assets/fonts/*.ttf"],
    "/promise/[id]/opengraph-image": ["./assets/fonts/*.ttf"],
  },
};

export default config;
