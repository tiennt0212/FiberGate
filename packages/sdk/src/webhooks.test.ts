import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyWebhookSignature, webhooks } from "./webhooks";

function signRaw(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("webhooks.verify", () => {
  const secret = "test-secret-at-least-32-bytes-long!";
  const body = JSON.stringify({ event: "payment.paid", data: { invoice_id: "inv_1" } });

  it("returns true for a signature computed the same way FiberGate signs it", () => {
    const signature = signRaw(body, secret);

    expect(webhooks.verify(body, signature, secret)).toBe(true);
  });

  it("returns false when the secret is wrong", () => {
    const signature = signRaw(body, secret);

    expect(webhooks.verify(body, signature, "a-completely-different-secret!!")).toBe(false);
  });

  it("returns false when the body has been tampered with after signing", () => {
    const signature = signRaw(body, secret);
    const tamperedBody = JSON.stringify({ event: "payment.paid", data: { invoice_id: "inv_2" } });

    expect(webhooks.verify(tamperedBody, signature, secret)).toBe(false);
  });

  it.each([
    ["missing the sha256= prefix", createHmac("sha256", secret).update(body, "utf8").digest("hex")],
    ["a short/malformed signature", "sha256=deadbeef"],
    ["an empty signature", ""],
  ])("returns false — not throw — for %s", (_description, malformedSignature) => {
    expect(() => webhooks.verify(body, malformedSignature, secret)).not.toThrow();
    expect(webhooks.verify(body, malformedSignature, secret)).toBe(false);
  });

  it("returns false for a signature one character off from correct", () => {
    const signature = signRaw(body, secret);
    const flippedLastChar = signature.slice(0, -1) + (signature.endsWith("a") ? "b" : "a");

    expect(webhooks.verify(body, flippedLastChar, secret)).toBe(false);
  });

  it("verifyWebhookSignature is the same function as webhooks.verify", () => {
    const signature = signRaw(body, secret);

    expect(verifyWebhookSignature(body, signature, secret)).toBe(webhooks.verify(body, signature, secret));
  });
});
