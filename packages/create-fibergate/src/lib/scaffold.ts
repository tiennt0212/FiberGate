import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Bundled by tsup into a single dist/cli.js, so this always resolves to
// <package root>/templates regardless of which source file it's inlined
// into — see scripts/copy-templates.mjs for how templates/ gets populated.
const DEFAULT_TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");

export interface ScaffoldInput {
  targetDir: string;
  envContent: string;
  /** Raw hex (fresh key) or already-encrypted bytes (reused key) — written as-is. */
  ckbKeyBytes: Buffer;
  templatesDir?: string;
}

export function directoryIsEmptyOrMissing(path: string): boolean {
  if (!existsSync(path)) return true;
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
  mkdirSync(join(targetDir, "docker", "nginx"), { recursive: true });

  copyFileSync(
    join(templatesDir, "docker-compose.release.yml"),
    join(targetDir, "docker-compose.release.yml"),
  );
  copyFileSync(
    join(templatesDir, "docker", "fiber-node", "config.yml"),
    join(targetDir, "docker", "fiber-node", "config.yml"),
  );
  copyFileSync(
    join(templatesDir, "docker", "nginx", "nginx.conf.template"),
    join(targetDir, "docker", "nginx", "nginx.conf.template"),
  );

  // .env holds every generated secret — restrict to owner-read/write, same
  // as the CKB key file below.
  writeFileSync(join(targetDir, ".env"), envContent, { mode: 0o600 });
  writeFileSync(join(targetDir, "docker", "fiber-node", "ckb", "key"), ckbKeyBytes, {
    mode: 0o600,
  });
}
