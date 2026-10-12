import { defineConfig } from "vitest/config";

// At most three test workers on a laptop (a 16 GB Mac hung with several sessions testing at once); CI keeps its default.
export default defineConfig({ test: { maxWorkers: process.env.CI ? undefined : 3 } });
