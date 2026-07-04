import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Unit tests for lib/api/* and app/api/v1/** route handlers (harness-brief.md
// "Bổ sung Bruno... và bổ sung testing"). Resolves the same `@/*` path alias
// declared in tsconfig.json's `compilerOptions.paths` via plain Vitest
// `resolve.alias` — no `vite-tsconfig-paths` dependency needed for this
// single alias.
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
