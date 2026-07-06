import { createHmac, timingSafeEqual } from "node:crypto";

// Mirrors apps/web/lib/webhooks/sign.ts's signWebhookPayload() exactly, per
// the harness brief's "Resolved decisions" (security-auth, confirmed
// 2026-07-06): HMAC-SHA256(secret, rawBodyUtf8Bytes) -> hex -> `sha256=${hex}`,
// compared against the caller-supplied signature with crypto.timingSafeEqual
// (BR-SEC-001, .context/guides/webhook-signature.md §5) — NOT the `===`
// shown in .context/api/rest-api-spec.md's inline "Webhook Payload" sample,
// which is a documented example, not the security-approved pattern.

/**
 * Verifies a FiberGate webhook's `X-Fiber-Signature` header against the
 * exact raw request body received over the wire.
 *
 * @param body - The **raw** JSON string body exactly as received (before
 *   `JSON.parse()`). Passing a re-`JSON.stringify()`'d object instead will
 *   silently fail for some payloads if key ordering or whitespace differs
 *   from what FiberGate originally signed — see
 *   .context/guides/webhook-signature.md §5.
 * @param signature - The full `X-Fiber-Signature` header value, including
 *   the `sha256=` prefix (e.g. read straight off
 *   `request.headers['x-fiber-signature']`).
 * @param secret - The webhook endpoint's secret, as shown once in the
 *   FiberGate dashboard when the endpoint was created.
 * @returns `true` if the signature matches, `false` otherwise — including
 *   for a malformed/short `signature` (never throws).
 */
function verify(body: string, signature: string, secret: string): boolean {
  const expectedSignature = `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  // crypto.timingSafeEqual() throws on mismatched-length buffers — check
  // first so a malformed/short signature returns `false` instead of
  // crashing the caller's webhook route handler.
  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

/** Namespace object exposed as both `FiberGate#webhooks` and the standalone `webhooks` export. */
export const webhooks = { verify };

/** Named alias for `webhooks.verify`, for callers who prefer a standalone function import. */
export const verifyWebhookSignature = verify;
