import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { requireEnv } from "@/lib/env";

// Service-layer for the generic `settings` key-value table (issue #30). First
// (and only, so far) consumer: the dashboard admin password hash, previously
// read exclusively from ADMIN_PASSWORD_HASH_B64.

const ADMIN_PASSWORD_HASH_KEY = "admin_password_hash";
const BCRYPT_COST_FACTOR = 10; // matches README's `htpasswd -nbBC 10` seed instructions

/**
 * Returns the current admin password's bcrypt hash. A `settings` row wins if
 * one exists (the admin has changed their password at least once via the
 * Dashboard); otherwise falls back to ADMIN_PASSWORD_HASH_B64 (env var,
 * base64-encoded — see app/login/actions.ts's original comment for why:
 * Docker Compose .env interpolation and dotenv-expand both mangle a raw
 * bcrypt hash's "$" characters, base64 has none). The env var only ever seeds
 * the *initial* value — once a DB row exists, it is never read again.
 */
export async function getAdminPasswordHash(): Promise<string> {
  const rows = await db.select().from(settings).where(eq(settings.key, ADMIN_PASSWORD_HASH_KEY)).limit(1);
  if (rows[0]) {
    return rows[0].value;
  }

  const passwordHashBase64 = requireEnv("ADMIN_PASSWORD_HASH_B64");
  return Buffer.from(passwordHashBase64, "base64").toString("utf-8");
}

/** Hashes `newPlaintextPassword` and upserts it as the admin password hash. */
export async function setAdminPassword(newPlaintextPassword: string): Promise<void> {
  const hash = await bcrypt.hash(newPlaintextPassword, BCRYPT_COST_FACTOR);
  await db
    .insert(settings)
    .values({ key: ADMIN_PASSWORD_HASH_KEY, value: hash, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: hash, updatedAt: new Date() },
    });
}
