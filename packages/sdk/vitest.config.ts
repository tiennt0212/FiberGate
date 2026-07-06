import { defineConfig } from "vitest/config";

// No path alias needed here (unlike apps/web's `@/*`) — packages/sdk is a
// standalone package with only relative imports under src/.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
