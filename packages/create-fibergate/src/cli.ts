import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { intro, log, note, outro, password as passwordPrompt, select, text } from "@clack/prompts";
import { decryptKeyFile, KeyFileDecryptionError } from "./lib/ckb-key-crypto";
import { buildEnvFile, REQUIRED_ENV_VARS } from "./lib/env-file";
import { InvalidHexKeyError, parseHexKeyFile } from "./lib/hex-key";
import {
  ask,
  askSecretValue,
  confirmOrExit,
  promptAdminPassword,
  promptDomain,
  promptPostgres,
} from "./lib/prompts";
import { randomHex32 } from "./lib/secrets";
import {
  directoryIsEmptyOrMissing,
  TargetPathNotADirectoryError,
  writeScaffold,
} from "./lib/scaffold";
import { validateSecretChars } from "./lib/validate-secret";

const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");

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

  let isEmptyOrMissing: boolean;
  try {
    isEmptyOrMissing = directoryIsEmptyOrMissing(targetDir);
  } catch (err) {
    if (err instanceof TargetPathNotADirectoryError) {
      log.error(`${targetDir} exists and isn't a directory — pick a different path.`);
      return promptTargetDir();
    }
    throw err;
  }

  if (!isEmptyOrMissing) {
    await confirmOrExit(
      `${targetDir} already exists and isn't empty. Continue and overwrite files in it?`,
    );
  }
  return targetDir;
}

interface CkbKeyResult {
  keyBytes: Buffer;
  passphrase: string;
}

/** Prompts for a path to an existing, readable file and resolves it to an absolute path. */
async function promptKeyPath(message: string): Promise<string> {
  const input = await ask(
    text({
      message,
      validate: (value) =>
        existsSync(resolve((value ?? "").trim())) ? undefined : "File not found.",
    }),
  );
  return resolve(input.trim());
}

async function promptFreshKey(): Promise<CkbKeyResult> {
  const keyPath = await promptKeyPath(
    "Path to your CKB testnet key file (raw hex, exported via `ckb-cli account export`):",
  );
  let keyBytes: Buffer;
  try {
    keyBytes = parseHexKeyFile(readFileSync(keyPath, "utf-8"));
  } catch (err) {
    if (err instanceof InvalidHexKeyError) {
      log.error(err.message);
      return promptFreshKey();
    }
    throw err;
  }
  const passphrase = await askSecretValue(
    "Passphrase to encrypt this key with",
    "FIBER_SECRET_KEY_PASSWORD",
  );
  return { keyBytes, passphrase };
}

async function promptReusedKey(): Promise<CkbKeyResult> {
  const keyPath = await promptKeyPath(
    "Path to the already-encrypted CKB key file from your prior deploy:",
  );
  const fileBytes = readFileSync(keyPath);

  for (;;) {
    const passphrase = await ask(
      passwordPrompt({
        message: "Passphrase for this key (FIBER_SECRET_KEY_PASSWORD):",
        validate: validateSecretChars,
      }),
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

async function promptDeployValues(): Promise<{ domain: string; ghcrNamespace: string }> {
  const domain = await promptDomain();
  const ghcrNamespace = await ask(
    text({
      message: "GitHub org/user the fibergate-core image was published under (GHCR_NAMESPACE):",
      // Matches .github/workflows/docker-publish.yml's IMAGE_NAME
      // (${{ github.repository_owner }}/fibergate-core) for this repo's own
      // canary builds. A fork publishing its own image should override this.
      initialValue: "tiennt0212",
      validate: (value) => ((value ?? "").trim() ? undefined : "Required."),
    }),
  );
  return { domain, ghcrNamespace: ghcrNamespace.trim() };
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
      "docker compose up -d",
      "",
      "fibergate-core runs pending DB migrations automatically before it starts",
      "serving — no manual migrate step, on first install or a later version upgrade.",
    ].join("\n"),
    "Next steps",
  );
  outro("Deploy directory ready.");
}

main().catch((err) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
