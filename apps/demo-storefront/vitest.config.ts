import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Same `@/*` alias / setup as apps/web/vitest.config.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
