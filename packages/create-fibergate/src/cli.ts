import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  password as passwordPrompt,
  select,
  text,
} from "@clack/prompts";
import { hashAdminPassword, MAX_PASSWORD_BYTES, passwordByteLength } from "./lib/admin-password";
import { decryptKeyFile, KeyFileDecryptionError } from "./lib/ckb-key-crypto";
import { buildEnvFile, REQUIRED_ENV_VARS } from "./lib/env-file";
import { randomHex32 } from "./lib/secrets";
import { directoryIsEmptyOrMissing, writeScaffold } from "./lib/scaffold";

const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");
const HEX_KEY_RE = /^[0-9a-fA-F]{64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOSTNAME_RE = /^(localhost|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})$/;

/** Unwraps a clack prompt result, exiting cleanly if the user cancelled (Ctrl+C). */
async function ask<T>(promise: Promise<T | symbol>): Promise<T> {
  const result = await promise;
  if (isCancel(result)) {
    cancel("Cancelled — nothing was written.");
    process.exit(0);
  }
  // isCancel()'s `value is symbol` guard doesn't narrow an unconstrained
  // generic T back down for TS — the symbol case has already exited above.
  return result as T;
}

async function askSecretValue(label: string, envVarName: string): Promise<string> {
  const choice = await ask(
    select({
      message: `${label}:`,
      options: [
        { value: "generate", label: "Generate a random value for me (recommended)" },
        { value: "custom", label: "Enter my own" },
      ],
    }),
  );
  if (choice === "generate") {
    const value = randomHex32();
    log.success(`${envVarName} generated.`);
    return value;
  }
  return ask(
    passwordPrompt({
      message: `Enter ${envVarName}:`,
      validate: (value) => {
        if (!value) return "Required.";
        if (value.includes("$") || value.includes("\n")) {
          return 'Avoid "$" or newlines — Docker Compose .env interpolation mangles them.';
        }
        return undefined;
      },
    }),
  );
}

async function promptTargetDir(): Promise<string> {
  const argDir = process.argv[2];
  const dirInput = await ask(
    text({
      message: "Where should the deploy directory be created?",
      initialValue: argDir ?? "fibergate-deploy",
      validate: (value) => ((value ?? "").trim() ? undefined : "Required."),
    }),
  );
  const targetDir = resolve(dirInput.trim());

  if (!directoryIsEmptyOrMissing(targetDir)) {
    const proceed = await ask(
      confirm({
        message: `${targetDir} already exists and isn't empty. Continue and overwrite files in it?`,
        initialValue: false,
      }),
    );
    if (!proceed) {
      cancel("Cancelled — nothing was written.");
      process.exit(0);
    }
  }
  return targetDir;
}

async function promptPostgres(): Promise<{ user: string; db: string; password: string }> {
  const user = await ask(text({ message: "Postgres user:", initialValue: "fibergate" }));
  const db = await ask(text({ message: "Postgres database name:", initialValue: "fibergate" }));
  const password = await askSecretValue("Postgres password", "POSTGRES_PASSWORD");
  return { user, db, password };
}

async function promptAdminPassword(): Promise<string> {
  const plaintext = await ask(
    passwordPrompt({
      message: "Choose the initial dashboard admin password (changeable later from Settings):",
      validate: (value) => {
        if (!value) return "Required.";
        if (passwordByteLength(value) > MAX_PASSWORD_BYTES) {
          return `Must be at most ${MAX_PASSWORD_BYTES} bytes (bcrypt silently truncates beyond that).`;
        }
        return undefined;
      },
    }),
  );
  const confirmation = await ask(passwordPrompt({ message: "Confirm password:" }));
  if (confirmation !== plaintext) {
    log.error("Passwords didn't match.");
    return promptAdminPassword();
  }
  return hashAdminPassword(plaintext);
}

interface CkbKeyResult {
  keyBytes: Buffer;
  passphrase: string;
}

async function promptFreshKey(): Promise<CkbKeyResult> {
  const keyPath = await ask(
    text({
      message:
        "Path to your CKB testnet key file (raw hex, exported via `ckb-cli account export`):",
      validate: (value) =>
        existsSync(resolve((value ?? "").trim())) ? undefined : "File not found.",
    }),
  );
  const raw = readFileSync(resolve(keyPath.trim()), "utf-8").trim();
  if (raw.startsWith("0x") || raw.startsWith("0X")) {
    log.error('Key file has an unsupported "0x" prefix — remove it and try again.');
    return promptFreshKey();
  }
  if (!HEX_KEY_RE.test(raw)) {
    log.error("Key file must be exactly one line of 64 raw hex characters.");
    return promptFreshKey();
  }
  const passphrase = await askSecretValue(
    "Passphrase to encrypt this key with",
    "FIBER_SECRET_KEY_PASSWORD",
  );
  return { keyBytes: Buffer.from(`${raw}\n`, "utf-8"), passphrase };
}

async function promptReusedKey(): Promise<CkbKeyResult> {
  const keyPath = await ask(
    text({
      message: "Path to the already-encrypted CKB key file from your prior deploy:",
      validate: (value) =>
        existsSync(resolve((value ?? "").trim())) ? undefined : "File not found.",
    }),
  );
  const fileBytes = readFileSync(resolve(keyPath.trim()));

  for (;;) {
    const passphrase = await ask(
      passwordPrompt({ message: "Passphrase for this key (FIBER_SECRET_KEY_PASSWORD):" }),
    );
    try {
      const plaintext = decryptKeyFile(fileBytes, passphrase);
      if (plaintext.length !== 32) {
        log.warn(
          `Decrypted key is ${plaintext.length} bytes, not the expected 32 — the passphrase ` +
            "is correct (integrity-checked), but double-check this is really a CKB secret key.",
        );
      } else {
        log.success("Passphrase verified against the key file.");
      }
      return { keyBytes: fileBytes, passphrase };
    } catch (err) {
      if (err instanceof KeyFileDecryptionError) {
        log.error(`${err.message} — try again, or Ctrl+C to cancel.`);
        continue;
      }
      throw err;
    }
  }
}

async function promptCkbKey(): Promise<CkbKeyResult> {
  const flow = await ask(
    select({
      message: "CKB testnet key for fiber-node:",
      options: [
        { value: "fresh", label: "Fresh key — never used with fiber-node before" },
        { value: "reuse", label: "Reuse a key already encrypted by a prior fiber-node deploy" },
      ],
    }),
  );
  return flow === "fresh" ? promptFreshKey() : promptReusedKey();
}

async function promptDeployValues(): Promise<{ domain: string; email: string; ghcrNamespace: string }> {
  const domain = await ask(
    text({
      message: "Public domain for this deploy (DNS must point at this host):",
      validate: (value) =>
        HOSTNAME_RE.test((value ?? "").trim()) ? undefined : "Not a valid hostname.",
    }),
  );
  const email = await ask(
    text({
      message: "Email for Let's Encrypt certificate expiry notices:",
      validate: (value) =>
        EMAIL_RE.test((value ?? "").trim()) ? undefined : "Not a valid email.",
    }),
  );
  const ghcrNamespace = await ask(
    text({
      message: "GitHub org/user the fibergate-core image was published under (GHCR_NAMESPACE):",
      validate: (value) => ((value ?? "").trim() ? undefined : "Required."),
    }),
  );
  return { domain: domain.trim(), email: email.trim(), ghcrNamespace: ghcrNamespace.trim() };
}

async function main() {
  intro("create-fibergate — scaffold a FiberGate merchant deploy");

  const targetDir = await promptTargetDir();
  const postgres = await promptPostgres();
  const adminPasswordHashB64 = await promptAdminPassword();
  const ckbKey = await promptCkbKey();
  const deployValues = await promptDeployValues();

  const values: Record<(typeof REQUIRED_ENV_VARS)[number], string> = {
    POSTGRES_USER: postgres.user,
    POSTGRES_DB: postgres.db,
    POSTGRES_PASSWORD: postgres.password,
    FIBER_SECRET_KEY_PASSWORD: ckbKey.passphrase,
    DOMAIN: deployValues.domain,
    CERTBOT_EMAIL: deployValues.email,
    ADMIN_PASSWORD_HASH_B64: adminPasswordHashB64,
    DASHBOARD_SESSION_SECRET: randomHex32(),
    FIBERGATE_INTERNAL_SECRET: randomHex32(),
    WEBHOOK_SECRET_ENCRYPTION_KEY: randomHex32(),
    GHCR_NAMESPACE: deployValues.ghcrNamespace,
  };

  const envTemplate = readFileSync(join(TEMPLATES_DIR, ".env.release.example"), "utf-8");
  const envContent = buildEnvFile(envTemplate, values);

  writeScaffold({
    targetDir,
    envContent,
    ckbKeyBytes: ckbKey.keyBytes,
    templatesDir: TEMPLATES_DIR,
  });

  note(
    [
      `cd ${targetDir}`,
      "docker compose -f docker-compose.release.yml up -d",
      "pnpm --filter web db:migrate   # or see README.md for running migrations without a repo clone",
    ].join("\n"),
    "Next steps",
  );
  outro("Deploy directory ready.");
}

main().catch((err) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
