// Shared by every secret written verbatim into .env — used by both
// askSecretValue's custom-entry path (POSTGRES_PASSWORD,
// FIBER_SECRET_KEY_PASSWORD) and promptReusedKey's passphrase prompt in
// cli.ts. Rejects two independent hazards this same set of values can hit:
//   - "$"/newline: Docker Compose's .env interpolation mangles "$..." as a
//     variable reference — breaks fiber-node's decryption of a key this CLI
//     just told the merchant "verified" successfully.
//   - "@", ":", "/": POSTGRES_PASSWORD specifically feeds an unescaped
//     `postgres://user:PASSWORD@host:port/db` template literal (both
//     lib/db/index.ts and apps/web/scripts/migrate.mjs) — any of these
//     breaks the connection-string parse. Applied to every value through
//     this shared validator rather than only POSTGRES_PASSWORD's own call
//     site, to keep one rule instead of two independently-drifting ones.
const UNSAFE_SECRET_CHARS_RE = /[$\n@:/]/;

export function validateSecretChars(value: string | undefined): string | undefined {
  if (!value) return "Required.";
  if (UNSAFE_SECRET_CHARS_RE.test(value)) {
    return 'Avoid "$", "@", ":", "/", or newlines — these break .env interpolation or Postgres connection strings.';
  }
  return undefined;
}
