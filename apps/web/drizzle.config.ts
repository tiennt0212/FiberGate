import type { Config } from "drizzle-kit";

import { requireEnv } from "./lib/env";

// Drizzle Kit's own credentials for `generate`/`migrate` (run standalone at
// dev/deploy time, outside the running Next.js app — this file is NOT
// imported by lib/db/index.ts, which builds its own connection string the
// same way but reads it at Next.js runtime instead of CLI time; both share
// the same `requireEnv` helper from lib/env.ts).
//
// No `DATABASE_URL` anywhere in this repo by design (decisions-log
// 2026-07-02: "Chốt lại: bỏ hẳn DATABASE_URL khỏi mọi nơi") — always derive
// credentials from the 5 POSTGRES_* vars. This file relies on the same
// dotenv-cli wrapper already used by apps/web's `dev` script
// (`dotenv -e .env.local -e ../../.env -- <command>`) to populate
// `process.env` before drizzle-kit runs — see the "db:generate"/"db:migrate"
// scripts in package.json. Do not add a `dotenv/config` import here; that
// would create a second, divergent way of loading env vars.

export default {
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dbCredentials: {
    host: requireEnv("POSTGRES_HOST"),
    port: Number(requireEnv("POSTGRES_PORT")),
    user: requireEnv("POSTGRES_USER"),
    password: requireEnv("POSTGRES_PASSWORD"),
    database: requireEnv("POSTGRES_DB"),
    ssl: false,
  },
} satisfies Config;
