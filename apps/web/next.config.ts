import type { NextConfig } from "next";
import places from "../../data/config/boroughs.json";

/**
 * The production address on Vercel before the site had its own domain. Once NEXT_PUBLIC_SITE_URL names another host
 * (the site's own domain), every request to the old address is sent there permanently, path and all. Until then, and
 * on previews where it is unset, nothing is redirected: one setting moves canonical links, the sitemap, feeds and the
 * redirect together.
 */
const OLD_HOST = "borough-ledger.vercel.app";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
const MOVED = SITE_URL && new URL(SITE_URL).host !== OLD_HOST ? SITE_URL : null;

/** Towns with a section of their own on their district's page: /henley-on-thames goes to /south-oxfordshire#henley-on-thames. */
const townId = (town: string) => town.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const BOROUGHS_WITH_TOWNS = places.boroughs.flatMap((b) => ("towns" in b && b.towns ? [{ slug: b.slug, towns: b.towns as string[] }] : []));

const config: NextConfig = {
  transpilePackages: ["@borough-ledger/schema", "@borough-ledger/engine", "@borough-ledger/server"],
  // Email alerts' database drivers run as they are on the server (packages/server).
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  reactStrictMode: true,
  poweredByHeader: false,
  // Old addresses keep working: the Vercel address once the site has its own domain, and /councillors (now /wards, M6).
  async redirects() {
    return [
      ...(MOVED ? [{ source: "/:path*", has: [{ type: "host" as const, value: OLD_HOST }], destination: `${MOVED}/:path*`, permanent: true }] : []),
      { source: "/councillors", destination: "/wards", permanent: true },
      // A town with its own section on its district's page (data/config/boroughs.json "towns").
      ...BOROUGHS_WITH_TOWNS.flatMap((b) => b.towns.map((t) => ({ source: `/${townId(t)}`, destination: `/${b.slug}#${townId(t)}`, permanent: false }))),
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
    "/party/[id]/opengraph-image": ["./assets/fonts/*.ttf"],
    "/topic/[slug]/opengraph-image": ["./assets/fonts/*.ttf"],
    "/ward/[id]/opengraph-image": ["./assets/fonts/*.ttf"],
    "/councillor/[id]/opengraph-image": ["./assets/fonts/*.ttf"],
    "/payments/[month]/opengraph-image": ["./assets/fonts/*.ttf"],
    "/council-tax-rise/opengraph-image": ["./assets/fonts/*.ttf"],
    "/council-tax-rise/[band]/opengraph-image": ["./assets/fonts/*.ttf"],
    "/supplier/[id]/og": ["./assets/fonts/*.ttf"],
  },
};

export default config;
