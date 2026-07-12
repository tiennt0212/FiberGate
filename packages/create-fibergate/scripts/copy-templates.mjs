// Copies the static files a merchant needs alongside a generated `.env` into
// `templates/` (gitignored — always freshly derived from the repo root, so it
// can never drift from what README.md's manual "Deploy from a published
// image" path instructs contributors to fetch by hand).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(packageDir, "..", "..");
const templatesDir = join(packageDir, "templates");

const files = [
  "docker-compose.release.yml",
  "docker/fiber-node/config.yml",
  "docker/nginx/nginx.conf.template",
  ".env.release.example",
];

for (const relativePath of files) {
  const src = join(repoRoot, relativePath);
  const dest = join(templatesDir, relativePath);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`copied ${relativePath}`);
}
