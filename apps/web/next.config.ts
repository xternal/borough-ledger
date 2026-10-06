import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@borough-ledger/schema", "@borough-ledger/engine"],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default config;
