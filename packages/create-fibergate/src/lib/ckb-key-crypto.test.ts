import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptKeyFile, encryptKeyFile, KeyFileDecryptionError } from "./ckb-key-crypto";

describe("ckb-key-crypto", () => {
  it("round-trips a 32-byte secret key with the right passphrase", () => {
    const plaintext = randomBytes(32);
    const encrypted = encryptKeyFile(plaintext, "correct horse battery staple");

    const decrypted = decryptKeyFile(encrypted, "correct horse battery staple");

    expect(decrypted).toEqual(plaintext);
  });

  it("rejects a wrong passphrase instead of silently producing garbage", () => {
    const plaintext = randomBytes(32);
    const encrypted = encryptKeyFile(plaintext, "correct horse battery staple");

    expect(() => decryptKeyFile(encrypted, "wrong passphrase")).toThrow(
      KeyFileDecryptionError,
    );
  });

  it("preserves the original AES-GCM error via cause instead of discarding it", () => {
    const plaintext = randomBytes(32);
    const encrypted = encryptKeyFile(plaintext, "correct horse battery staple");

    try {
      decryptKeyFile(encrypted, "wrong passphrase");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(KeyFileDecryptionError);
      expect((err as Error).cause).toBeInstanceOf(Error);
    }
  });

  it("rejects a file with an unsupported version byte", () => {
    const encrypted = encryptKeyFile(randomBytes(32), "password");
    encrypted[0] = 1;

    expect(() => decryptKeyFile(encrypted, "password")).toThrow(KeyFileDecryptionError);
  });

  it("rejects a file that's too short to be valid", () => {
    expect(() => decryptKeyFile(Buffer.from([0, 1, 2]), "password")).toThrow(
      KeyFileDecryptionError,
    );
  });
});
