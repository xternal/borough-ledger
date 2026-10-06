#!/usr/bin/env node
/** Vercel build command: production deployments run the strict build, previews may show marked test data. */
import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
const cmd = env === "production" ? "pnpm run build:prod" : "pnpm run build:preview";
console.log(`VERCEL_ENV=${env ?? "unset"}: ${cmd}`);
execSync(cmd, { stdio: "inherit" });
