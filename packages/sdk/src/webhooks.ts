import { createHmac, timingSafeEqual } from "node:crypto";
import type { WebhookPayload } from "./types.js";

/** Thrown when a webhook signature does not match the raw body. */
export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

/**
 * Verify the `X-Fiber-Signature` header against the raw request body.
 * Always pass the RAW body string — not a re-serialized object — or the HMAC
 * will not match (JSON key ordering / whitespace differ).
 */
export function verify(rawBody: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Verify then parse the payload. Throws `WebhookVerificationError` if invalid,
 * so a successful return guarantees the body is authentic.
 */
export function constructEvent(rawBody: string, signature: string, secret: string): WebhookPayload {
  if (!verify(rawBody, signature, secret)) {
    throw new WebhookVerificationError("Webhook signature verification failed");
  }
  return JSON.parse(rawBody) as WebhookPayload;
}
