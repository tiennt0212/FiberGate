import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decryptWebhookSecret, encryptWebhookSecret } from "./secret-crypto";

const VALID_KEY_HEX = "11".repeat(32); // 64 hex chars = 32 bytes

describe("encryptWebhookSecret / decryptWebhookSecret", () => {
  beforeEach(() => {
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = VALID_KEY_HEX;
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  });

  it("round-trips a plaintext secret through encrypt then decrypt", () => {
    const plaintext = "a".repeat(64); // matches the >=32-byte hex secret shape

    const encrypted = encryptWebhookSecret(plaintext);
    const decrypted = decryptWebhookSecret(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV) for the same plaintext", () => {
    const plaintext = "same-secret-value";

    const first = encryptWebhookSecret(plaintext);
    const second = encryptWebhookSecret(plaintext);

    expect(first).not.toBe(second);
    expect(decryptWebhookSecret(first)).toBe(plaintext);
    expect(decryptWebhookSecret(second)).toBe(plaintext);
  });

  it("stores the encrypted value as 3 ':'-separated base64 segments (iv:authTag:ciphertext)", () => {
    const encrypted = encryptWebhookSecret("some-secret");
    expect(encrypted.split(":")).toHaveLength(3);
  });

  it("throws when WEBHOOK_SECRET_ENCRYPTION_KEY is missing", () => {
    delete process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;

    expect(() => encryptWebhookSecret("secret")).toThrow(/Missing required env var/);
  });

  it("throws a clear error when WEBHOOK_SECRET_ENCRYPTION_KEY is the wrong length", () => {
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "not-64-hex-chars";

    expect(() => encryptWebhookSecret("secret")).toThrow(/64-character hex string/);
  });

  it("throws a clear error when WEBHOOK_SECRET_ENCRYPTION_KEY is not valid hex", () => {
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "g".repeat(64); // right length, invalid hex digit

    expect(() => encryptWebhookSecret("secret")).toThrow(/64-character hex string/);
  });

  it("throws on a malformed encrypted value (wrong number of segments)", () => {
    expect(() => decryptWebhookSecret("only-one-segment")).toThrow(/Malformed encrypted webhook secret/);
  });

  it("throws (auth tag check fails) when decrypting with a different key than it was encrypted with", () => {
    const encrypted = encryptWebhookSecret("secret-value");

    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "22".repeat(32);

    expect(() => decryptWebhookSecret(encrypted)).toThrow();
  });
});
