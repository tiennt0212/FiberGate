import { randomBytes } from "node:crypto";

/** Same shape as `openssl rand -hex 32` — a 64-char hex string (32 bytes). */
export function randomHex32(): string {
  return randomBytes(32).toString("hex");
}
