import { createHmac, randomBytes } from "node:crypto";

/** BR-SEC-003: webhook secrets are random and at least 32 bytes. */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/** BR-WHK-004: sign the raw JSON body with HMAC-SHA256 → `sha256=<hex>`. */
export function signPayload(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}
