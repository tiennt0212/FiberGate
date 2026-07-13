// Mirrors `fnn`'s own encrypted CKB key file format so the CLI can validate a
// merchant-supplied passphrase against an already-encrypted key file offline,
// before writing anything to disk. Source of truth (read directly, not
// guessed): nervosnetwork/fiber @ v0.9.0-rc6,
// crates/fiber-lib/src/utils/encrypt_decrypt_file.rs.
//
// File layout: [1-byte version][16-byte scrypt salt][12-byte AES-GCM
// nonce][ciphertext (AEAD, includes the 16-byte GCM tag appended at the end)].
// Key derivation: scrypt(password, salt, N=131072, r=8, p=1, dklen=32) — the
// `scrypt` Rust crate's `Params::recommended()` (OWASP cheat sheet values).
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const VERSION = 0;
const SALT_LEN = 16;
const NONCE_LEN = 12;
const GCM_TAG_LEN = 16;
const SCRYPT_N = 131072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
// scrypt needs roughly 128 * N * r bytes of working memory (~128MiB here);
// Node's scryptSync default maxmem (32MiB) is too low for these params and
// throws ERR_CRYPTO_SCRYPT_INVALID_PARAMETER without an explicit override.
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

export class KeyFileDecryptionError extends Error {}

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
}

/**
 * Decrypts a CKB secret key file previously encrypted by `fnn`. Throws
 * `KeyFileDecryptionError` if the passphrase is wrong (AES-GCM auth tag
 * mismatch) or the file doesn't look like this format.
 */
export function decryptKeyFile(fileBytes: Buffer, password: string): Buffer {
  if (fileBytes.length < 1 + SALT_LEN + NONCE_LEN + GCM_TAG_LEN) {
    throw new KeyFileDecryptionError("key file is too short to be a valid encrypted key");
  }
  if (fileBytes[0] !== VERSION) {
    throw new KeyFileDecryptionError(`unsupported key file version: ${fileBytes[0]}`);
  }

  const salt = fileBytes.subarray(1, 1 + SALT_LEN);
  const nonce = fileBytes.subarray(1 + SALT_LEN, 1 + SALT_LEN + NONCE_LEN);
  const ciphertextWithTag = fileBytes.subarray(1 + SALT_LEN + NONCE_LEN);
  const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - GCM_TAG_LEN);
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - GCM_TAG_LEN);

  const key = deriveKey(password, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (cause) {
    // AES-GCM auth failure is by far the most likely cause (wrong
    // passphrase), but preserve the original error via `cause` rather than
    // discarding it — a corrupted file or a bug in this reimplementation
    // would otherwise be indistinguishable from a simple wrong passphrase.
    throw new KeyFileDecryptionError("passphrase does not match this key file", { cause });
  }
}

/**
 * Inverse of `decryptKeyFile`, kept test-internal only: builds deterministic
 * round-trip fixtures for `ckb-key-crypto.test.ts` (scrypt's cost makes
 * hand-authoring binary fixtures impractical). The CLI wizard never calls
 * this — it never mints new encrypted key files itself, only validates
 * existing ones (see issue #48 scope notes).
 */
export function encryptKeyFile(plaintext: Buffer, password: string): Buffer {
  const salt = randomBytes(SALT_LEN);
  const nonce = randomBytes(NONCE_LEN);
  const key = deriveKey(password, salt);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), salt, nonce, ciphertext, tag]);
}
