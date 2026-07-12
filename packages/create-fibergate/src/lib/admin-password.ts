import bcrypt from "bcryptjs";

// Matches apps/web/app/(dashboard)/settings/actions.ts's MAX_PASSWORD_BYTES /
// apps/web/lib/services/settings.ts's BCRYPT_COST_FACTOR exactly, so a
// password set here hashes identically to one set later from Dashboard ->
// Settings.
export const MAX_PASSWORD_BYTES = 72;
const BCRYPT_COST_FACTOR = 10;

export function passwordByteLength(password: string): number {
  return Buffer.byteLength(password, "utf-8");
}

/**
 * Hashes the initial admin dashboard password and base64-encodes it, ready
 * to paste into ADMIN_PASSWORD_HASH_B64 — base64, not the raw "$2b$10$..."
 * hash, for the same reason README.md's "Generating secrets" section
 * documents: Docker Compose's .env interpolation and dotenv-expand each
 * mangle a raw bcrypt hash's "$" characters differently.
 */
export async function hashAdminPassword(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
  return Buffer.from(hash, "utf-8").toString("base64");
}
