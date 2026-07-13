// Generates a working root `.env` for the from-source/contributor deploy path
// (docker-compose.yml, `pnpm docker:dev`) — the counterpart to cli.ts's
// scaffolding flow, but writes directly into this repo checkout instead of a
// fresh target directory, and reads `.env.example` live from the repo root
// instead of a bundled template (see docs/maintainers/getting-started.md's
// "Generating a real `.env`", issue #55). Doesn't touch the CKB signing key —
// that step stays the manual `ckb-cli account export` flow documented there.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cancel, confirm, intro, log, note, outro } from "@clack/prompts";
import { buildEnvFile, LOCAL_REQUIRED_ENV_VARS } from "./lib/env-file";
import { ask, askSecretValue, promptAdminPassword, promptDomain, promptPostgres } from "./lib/prompts";
import { randomHex32 } from "./lib/secrets";

// dist/generate-local-env.js -> packages/create-fibergate/dist -> packages/create-fibergate -> packages -> repo root
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

async function main() {
  intro("generate-local-env — write a working root .env for this checkout");

  const envPath = join(REPO_ROOT, ".env");
  if (existsSync(envPath)) {
    const proceed = await ask(
      confirm({
        message: `${envPath} already exists — overwrite it?`,
        initialValue: false,
      }),
    );
    if (!proceed) {
      cancel("Cancelled — nothing was written.");
      process.exit(0);
    }
  }

  const postgres = await promptPostgres();
  const adminPasswordHashB64 = await promptAdminPassword();
  const domain = await promptDomain();
  const fiberSecretKeyPassword = await askSecretValue(
    "Passphrase to encrypt your CKB testnet key with",
    "FIBER_SECRET_KEY_PASSWORD",
  );

  const values: Record<(typeof LOCAL_REQUIRED_ENV_VARS)[number], string> = {
    POSTGRES_USER: postgres.user,
    POSTGRES_DB: postgres.db,
    POSTGRES_PASSWORD: postgres.password,
    FIBER_SECRET_KEY_PASSWORD: fiberSecretKeyPassword,
    DOMAIN: domain,
    ADMIN_PASSWORD_HASH_B64: adminPasswordHashB64,
    DASHBOARD_SESSION_SECRET: randomHex32(),
    FIBERGATE_INTERNAL_SECRET: randomHex32(),
    WEBHOOK_SECRET_ENCRYPTION_KEY: randomHex32(),
  };

  const template = readFileSync(join(REPO_ROOT, ".env.example"), "utf-8");
  const envContent = buildEnvFile(template, values);

  // Holds every generated secret — restrict to owner-read/write.
  writeFileSync(envPath, envContent, { mode: 0o600 });

  note(
    [
      "Still needed (not automated by this script):",
      "- CKB testnet signing key at docker/fiber-node/ckb/key, encrypted with",
      "  the FIBER_SECRET_KEY_PASSWORD you just chose — see",
      "  docs/maintainers/getting-started.md's \"Generating a real .env\".",
      "",
      "Then: pnpm docker:dev   (or docker compose up -d for the full stack)",
    ].join("\n"),
    "Next steps",
  );
  outro(`${envPath} written.`);
}

main().catch((err) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
