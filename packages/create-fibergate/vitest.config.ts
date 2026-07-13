import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    // scrypt(N=131072, r=8, p=1) is deliberately expensive (~200-500ms per
    // call) — the default per case timeout is too tight once a test does a
    // handful of encrypt/decrypt round-trips.
    testTimeout: 15000,
  },
});
