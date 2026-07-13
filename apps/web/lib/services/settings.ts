import bcrypt from "bcryptjs";
import { DrizzleQueryError, eq } from "drizzle-orm";
import postgres from "postgres";

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { requireEnv } from "@/lib/env";

// Service-layer for the generic `settings` key-value table (issue #30). First
// (and only, so far) consumer: the dashboard admin password hash, previously
// read exclusively from ADMIN_PASSWORD_HASH_B64.

const ADMIN_PASSWORD_HASH_KEY = "admin_password_hash";
const BCRYPT_COST_FACTOR = 10; // matches README's `htpasswd -nbBC 10` seed instructions

// PostgreSQL's SQLSTATE code for "undefined_table" — stable across Postgres
// versions/locales, unlike matching on the error message text. Confirmed by
// reproducing the error directly: querying `settings` before migrations have
// run throws a DrizzleQueryError whose `.cause` is a `postgres.PostgresError`
// with this code.
const UNDEFINED_TABLE = "42P01";

function isMissingTableError(err: unknown): boolean {
  return (
    err instanceof DrizzleQueryError &&
    err.cause instanceof postgres.PostgresError &&
    err.cause.code === UNDEFINED_TABLE
  );
}

/**
 * Returns the current admin password's bcrypt hash. A `settings` row wins if
 * one exists (the admin has changed their password at least once via the
 * Dashboard); otherwise falls back to ADMIN_PASSWORD_HASH_B64 (env var,
 * base64-encoded — see app/login/actions.ts's original comment for why:
 * Docker Compose .env interpolation and dotenv-expand both mangle a raw
 * bcrypt hash's "$" characters, base64 has none). The env var only ever seeds
 * the *initial* value — once a DB row exists, it is never read again.
 *
 * Also falls back the same way if the `settings` table doesn't exist yet
 * (migrations haven't run). In the Docker image this window can't actually
 * be hit — the container's CMD runs migrate.mjs to completion before the
 * server starts (see docker/fibergate-core/Dockerfile), so no request ever
 * reaches this path there. It matters for local `pnpm dev`, where nothing
 * runs migrations automatically: without this fallback, logging in before a
 * developer manually runs `db:migrate` would surface as a generic "Could not
 * verify the password right now" instead of actually logging in. Any other
 * DB error (connection failure, etc.) still propagates — this only swallows
 * the specific "table doesn't exist" case.
 */
export async function getAdminPasswordHash(): Promise<string> {
  let rows: (typeof settings.$inferSelect)[];
  try {
    rows = await db.select().from(settings).where(eq(settings.key, ADMIN_PASSWORD_HASH_KEY)).limit(1);
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    rows = [];
  }
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
