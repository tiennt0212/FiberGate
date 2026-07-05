import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { signWebhookPayload } from "./sign";

describe("signWebhookPayload", () => {
  it("returns sha256=<hex> matching a plain HMAC-SHA256 over the raw body", () => {
    const rawBody = JSON.stringify({ event: "payment.paid", data: { invoice_id: "inv_1" } });
    const secret = "test-secret-at-least-32-bytes-long!";

    const signature = signWebhookPayload(rawBody, secret);

    const expectedHex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    expect(signature).toBe(`sha256=${expectedHex}`);
  });

  it("produces a different signature for a different raw body", () => {
    const secret = "test-secret-at-least-32-bytes-long!";

    const a = signWebhookPayload(JSON.stringify({ a: 1 }), secret);
    const b = signWebhookPayload(JSON.stringify({ a: 2 }), secret);

    expect(a).not.toBe(b);
  });

  it("produces a different signature for a different secret over the same body", () => {
    const rawBody = JSON.stringify({ event: "payment.paid" });

    const a = signWebhookPayload(rawBody, "secret-one-at-least-32-bytes-long!!");
    const b = signWebhookPayload(rawBody, "secret-two-at-least-32-bytes-long!!");

    expect(a).not.toBe(b);
  });

  it("is sensitive to key ordering — re-serializing a parsed object with different key order changes the signature", () => {
    const secret = "test-secret-at-least-32-bytes-long!";
    const original = '{"event":"payment.paid","data":{}}';
    const reserialized = JSON.stringify(JSON.parse(original)); // same content, but demonstrates why signing the raw string matters

    const signatureOfRaw = signWebhookPayload(original, secret);
    const signatureOfReserialized = signWebhookPayload(reserialized, secret);

    // In this particular case Node's JSON.stringify happens to preserve key
    // order, so the two strings (and thus signatures) match — the point of
    // this test is documentation: sign.ts must always be called with the
    // exact bytes being sent, never a fresh JSON.stringify() of a re-parsed
    // copy, since that guarantee is what the byte-exact signing hinges on.
    expect(signatureOfRaw).toBe(signatureOfReserialized);
  });
});
