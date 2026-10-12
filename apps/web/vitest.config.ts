import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // server-only throws outside the React server runtime; tests run model code directly.
      "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)),
    },
  },
  // At most three test workers on a laptop (a 16 GB Mac hung with several sessions testing at once); CI keeps its default.
  test: { include: ["test/**/*.test.ts", "scripts/**/*.test.mjs"], maxWorkers: process.env.CI ? undefined : 3 },
});
