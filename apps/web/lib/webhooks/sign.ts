import { createHmac } from "node:crypto";

// Single place that computes a webhook signature (BR-WHK-004) — reused by
// the first-attempt delivery, every retry, and resend (lib/webhooks/deliver.ts)
// so there is exactly one implementation to get byte-exact.

/**
 * HMAC-SHA256 signs `rawBody` — the *exact* raw JSON string about to be sent
 * as the POST body, not a re-serialized copy of the parsed object (a second
 * `JSON.stringify()` on the same object is not guaranteed to reproduce
 * identical bytes if key ordering ever diverges) — keyed by the firing
 * endpoint's own decrypted secret. Returns the full `X-Fiber-Signature`
 * header value.
 */
export function signWebhookPayload(rawBody: string, decryptedSecret: string): string {
  const hex = createHmac("sha256", decryptedSecret).update(rawBody, "utf8").digest("hex");
  return `sha256=${hex}`;
}
