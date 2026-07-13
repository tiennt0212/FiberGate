import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { decryptKeyFile, encryptKeyFile, KeyFileDecryptionError } from "./ckb-key-crypto";

describe("ckb-key-crypto", () => {
  // Shared by the round-trip and wrong-passphrase tests below: encryptKeyFile's scrypt
  // derivation is deliberately expensive (N=131072, ~128 MiB working set), so derive it
  // once instead of once per test.
  let plaintext: Buffer;
  let encrypted: Buffer;

  beforeAll(() => {
    plaintext = randomBytes(32);
    encrypted = encryptKeyFile(plaintext, "correct horse battery staple");
  });

  it("round-trips a 32-byte secret key with the right passphrase", () => {
    const decrypted = decryptKeyFile(encrypted, "correct horse battery staple");

    expect(decrypted).toEqual(plaintext);
  });

  it("rejects a wrong passphrase, preserving the original AES-GCM error via cause instead of discarding it", () => {
    try {
      decryptKeyFile(encrypted, "wrong passphrase");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(KeyFileDecryptionError);
      expect((err as Error).cause).toBeInstanceOf(Error);
    }
  });

  it("rejects a file with an unsupported version byte", () => {
    const encryptedWithBadVersion = encryptKeyFile(randomBytes(32), "password");
    encryptedWithBadVersion[0] = 1;

    expect(() => decryptKeyFile(encryptedWithBadVersion, "password")).toThrow(
      KeyFileDecryptionError,
    );
  });

  it("rejects a file that's too short to be valid", () => {
    expect(() => decryptKeyFile(Buffer.from([0, 1, 2]), "password")).toThrow(
      KeyFileDecryptionError,
    );
  });
});
