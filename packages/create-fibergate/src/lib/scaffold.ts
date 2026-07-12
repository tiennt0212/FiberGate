import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Bundled by tsup into a single dist/cli.js, so this always resolves to
// <package root>/templates regardless of which source file it's inlined
// into — see scripts/copy-templates.mjs for how templates/ gets populated.
const DEFAULT_TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");

// .env.release.example isn't copied as-is — cli.ts reads it separately to
// build the generated .env content (see buildEnvFile in lib/env-file.ts).
// docker-compose.release.yml isn't copied under its own name either — a
// scaffolded deploy directory has no other compose file to disambiguate
// from, so it's written out as the plain `docker-compose.yml` Docker looks
// for by default (no `-f` flag needed).
const SKIP_TEMPLATE_FILES = new Set([".env.release.example", "docker-compose.release.yml"]);
const COMPOSE_TEMPLATE_NAME = "docker-compose.release.yml";
const COMPOSE_OUTPUT_NAME = "docker-compose.yml";

/**
 * Recursively copies every file under `srcDir` into `destDir` (skipping
 * `SKIP_TEMPLATE_FILES`), preserving relative paths. Deliberately doesn't
 * hardcode the list of deploy files a second time — `templatesDir` already
 * holds exactly the files `scripts/copy-templates.mjs` decided to sync from
 * the repo root, so mirroring its output here can never drift out of sync
 * with that list.
 */
function copyTemplateTree(srcDir: string, destDir: string, relDir = ""): void {
  for (const entry of readdirSync(join(srcDir, relDir), { withFileTypes: true })) {
    const relPath = join(relDir, entry.name);
    if (entry.isDirectory()) {
      copyTemplateTree(srcDir, destDir, relPath);
      continue;
    }
    if (SKIP_TEMPLATE_FILES.has(relPath)) continue;
    mkdirSync(join(destDir, relDir), { recursive: true });
    copyFileSync(join(srcDir, relPath), join(destDir, relPath));
  }
}

export interface ScaffoldInput {
  targetDir: string;
  envContent: string;
  /** Raw hex (fresh key) or already-encrypted bytes (reused key) — written as-is. */
  ckbKeyBytes: Buffer;
  templatesDir?: string;
}

export class TargetPathNotADirectoryError extends Error {}

/** Throws `TargetPathNotADirectoryError` if `path` exists but isn't a directory. */
export function directoryIsEmptyOrMissing(path: string): boolean {
  if (!existsSync(path)) return true;
  if (!statSync(path).isDirectory()) {
    throw new TargetPathNotADirectoryError(`${path} exists and is not a directory.`);
  }
  return readdirSync(path).length === 0;
}

export function writeScaffold({
  targetDir,
  envContent,
  ckbKeyBytes,
  templatesDir = DEFAULT_TEMPLATES_DIR,
}: ScaffoldInput): void {
  mkdirSync(targetDir, { recursive: true });
  mkdirSync(join(targetDir, "docker", "fiber-node", "ckb"), { recursive: true });

  copyTemplateTree(templatesDir, targetDir);
  copyFileSync(join(templatesDir, COMPOSE_TEMPLATE_NAME), join(targetDir, COMPOSE_OUTPUT_NAME));

  // .env holds every generated secret — restrict to owner-read/write, same
  // as the CKB key file below.
  writeFileSync(join(targetDir, ".env"), envContent, { mode: 0o600 });
  writeFileSync(join(targetDir, "docker", "fiber-node", "ckb", "key"), ckbKeyBytes, {
    mode: 0o600,
  });
}
