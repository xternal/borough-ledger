import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@borough-ledger/schema", "@borough-ledger/engine"],
  reactStrictMode: true,
  poweredByHeader: false,
  // Share images rendered on request read their fonts from disk; make sure the files ship with them (lib/ogFonts.ts).
  outputFileTracingIncludes: {
    "/balance/og": ["./assets/fonts/*.ttf"],
    "/opengraph-image": ["./assets/fonts/*.ttf"],
    "/twitter-image": ["./assets/fonts/*.ttf"],
    "/promise/[id]/opengraph-image": ["./assets/fonts/*.ttf"],
  },
};

export default config;
