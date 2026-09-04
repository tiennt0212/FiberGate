import { describe, expect, it } from "vitest";
import { needsP2pDomainPrompt } from "./prompts";

// The CDN question's own gate. Extracted from promptP2pDomain() so the branch
// is testable without driving an interactive prompt; the .env round-trip it
// feeds lives in env-file.test.ts, next to the template fixtures it needs.
describe("needsP2pDomainPrompt", () => {
  it("skips the CDN question for the localhost default", () => {
    expect(needsP2pDomainPrompt("localhost")).toBe(false);
    expect(needsP2pDomainPrompt("  LocalHost  ")).toBe(false);
  });

  it("asks for any real hostname", () => {
    expect(needsP2pDomainPrompt("shop.example.com")).toBe(true);
    expect(needsP2pDomainPrompt("example.com")).toBe(true);
  });
});
