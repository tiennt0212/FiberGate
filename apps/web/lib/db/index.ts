import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { requireEnv } from "../env";
import * as schema from "./schema";

// No `DATABASE_URL` anywhere in this repo by design (decisions-log
// 2026-07-02) — the connection string is always derived from the 5
// POSTGRES_* vars, one code path shared by Docker (docker-compose.yml's
// fibergate-core service, which sets POSTGRES_HOST/PORT to the fixed
// "postgres"/5432) and `pnpm dev` (apps/web/.env.local overrides
// POSTGRES_HOST/PORT for local dev outside Docker). See
// .context/architecture/system-design.md "Environment Variables".
const connectionString = `postgres://${requireEnv("POSTGRES_USER")}:${requireEnv(
  "POSTGRES_PASSWORD",
)}@${requireEnv("POSTGRES_HOST")}:${requireEnv("POSTGRES_PORT")}/${requireEnv(
  "POSTGRES_DB",
)}`;

const client = postgres(connectionString);

export const db = drizzle(client, { schema });

export type Database = typeof db;
