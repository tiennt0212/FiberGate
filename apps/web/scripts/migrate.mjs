// Runs pending Drizzle migrations against POSTGRES_* before fibergate-core's
// Docker CMD starts the server (docker/fibergate-core/Dockerfile) — so a
// merchant deploying via docker-compose.yml/docker-compose.release.yml never
// runs a manual migrate step, on first install or any later version
// upgrade.
//
// Deliberately NOT the drizzle-kit CLI (`db:migrate` in package.json, still
// the right tool for local dev / `pnpm --filter web db:migrate`) — that
// pulls in a much heavier devDependency toolchain not worth bundling into
// the production image. Uses drizzle-orm's programmatic migrator directly:
// drizzle-orm and postgres are both zero-runtime-dependency packages, small
// enough to copy into the image on their own (see Dockerfile's builder
// stage).
//
// Connection string mirrors lib/db/index.ts exactly (duplicated
// intentionally — that module isn't reachable from this standalone script's
// module resolution path once bundled into the image).
//
// Idempotent: drizzle-orm tracks applied migrations in a
// __drizzle_migrations table, so a restart with no new migration files is a
// fast no-op — this is what makes auto-migrate-on-boot safe to run on every
// container start, not just the first.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

const connectionString = `postgres://${requireEnv("POSTGRES_USER")}:${requireEnv(
  "POSTGRES_PASSWORD",
)}@${requireEnv("POSTGRES_HOST")}:${requireEnv("POSTGRES_PORT")}/${requireEnv("POSTGRES_DB")}`;

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "db", "migrations");

const sql = postgres(connectionString, { max: 1 });

try {
  console.log("Running database migrations...");
  await migrate(drizzle(sql), { migrationsFolder });
  console.log("Migrations complete.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
