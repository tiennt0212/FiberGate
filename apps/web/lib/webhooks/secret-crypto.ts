import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { requireEnv } from "@/lib/env";

// AES-256-GCM encryption for webhook_endpoints.secret at rest (Resolved
// Decision #1, harness-brief.md issue #8): database-schema.md's "lưu
// encrypted" note for this column is accurate as of this file — nothing
// upstream of this module ever sees the encrypted bytes; encrypt happens at
// endpoint-creation time (lib/services/webhooks.ts), decrypt happens only at
// the point of HMAC-signing a payload (lib/webhooks/sign.ts). Never log or
// return the decrypted secret.

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32; // AES-256
const IV_LENGTH_BYTES = 12; // GCM-recommended nonce size
// Encrypted-value wire format: "<iv-b64>:<authTag-b64>:<ciphertext-b64>".
const ENCRYPTED_PARTS_COUNT = 3;

/**
 * `WEBHOOK_SECRET_ENCRYPTION_KEY` is a 64-character hex string encoding a
 * 32-byte AES-256 key (e.g. generated via `openssl rand -hex 32` — same
 * encoding convention as documented in README.md "Generating secrets").
 * Validated on every call so a malformed key fails fast and loudly instead
 * of silently producing unusable ciphertext.
 */
function loadEncryptionKey(): Buffer {
  const raw = requireEnv("WEBHOOK_SECRET_ENCRYPTION_KEY");

  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      "WEBHOOK_SECRET_ENCRYPTION_KEY must be a 64-character hex string " +
        `encoding a 32-byte AES-256 key (got ${raw.length} characters); ` +
        "generate one via `openssl rand -hex 32`",
    );
  }

  const key = Buffer.from(raw, "hex");
  if (key.length !== KEY_LENGTH_BYTES) {
    // Unreachable given the regex above (64 hex chars always decodes to 32
    // bytes), but kept as an explicit invariant check rather than trusting
    // the regex alone.
    throw new Error(
      `WEBHOOK_SECRET_ENCRYPTION_KEY decoded to ${key.length} bytes, expected ${KEY_LENGTH_BYTES}`,
    );
  }

  return key;
}

/** Encrypts a webhook endpoint's plaintext secret for storage in `webhook_endpoints.secret`. */
export function encryptWebhookSecret(plaintextSecret: string): string {
  const key = loadEncryptionKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextSecret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/**
 * Decrypts a `webhook_endpoints.secret` value back to the plaintext secret
 * used to HMAC-sign outgoing payloads (lib/webhooks/sign.ts). Never log or
 * return the result beyond that immediate signing use.
 */
export function decryptWebhookSecret(encryptedSecret: string): string {
  const parts = encryptedSecret.split(":");
  if (parts.length !== ENCRYPTED_PARTS_COUNT) {
    throw new Error(
      `Malformed encrypted webhook secret: expected ${ENCRYPTED_PARTS_COUNT} ':'-separated base64 segments, got ${parts.length}`,
    );
  }
  const [ivB64, authTagB64, ciphertextB64] = parts as [string, string, string];

  const key = loadEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return plaintext.toString("utf8");
}
