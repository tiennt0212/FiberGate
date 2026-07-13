// Validates a raw-hex CKB secret key file (as exported via `ckb-cli account
// export`) before it's written into a fresh scaffold. Mirrors how the
// already-encrypted-key path's parsing lives in `ckb-key-crypto.ts` rather
// than in the wizard itself.
const HEX_KEY_RE = /^[0-9a-fA-F]{64}$/;

export class InvalidHexKeyError extends Error {}

/**
 * Validates a raw hex CKB secret key file's contents and returns the bytes
 * to write to disk (trailing newline included, matching `ckb-cli`'s own
 * export format). Throws `InvalidHexKeyError` with a user-facing message if
 * the content isn't exactly one line of 64 raw hex characters.
 */
export function parseHexKeyFile(raw: string): Buffer {
  const trimmed = raw.trim();
  if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
    throw new InvalidHexKeyError(
      'Key file has an unsupported "0x" prefix — remove it and try again.',
    );
  }
  if (!HEX_KEY_RE.test(trimmed)) {
    throw new InvalidHexKeyError("Key file must be exactly one line of 64 raw hex characters.");
  }
  return Buffer.from(`${trimmed}\n`, "utf-8");
}
