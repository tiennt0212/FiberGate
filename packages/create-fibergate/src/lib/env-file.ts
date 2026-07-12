// Builds the final `.env` from the bundled `.env.release.example` template
// text plus collected values — targeted `VAR=...` line replacement, so every
// explanatory comment in the template survives untouched. .env.release.example
// stays the single source of truth for var documentation; nothing here
// re-authors it.
const VAR_LINE = /^([A-Z0-9_]+)=(.*)$/;

// Every var the wizard collects a value for — [FIXED VALUE]/optional vars
// (FIBER_NODE_URL, FIBER_NODE_RPC_AUTH_TOKEN, CRON_SECRET,
// FIBERGATE_CORE_TAG) are deliberately excluded here: they're left exactly
// as .env.release.example already has them (fixed default, or blank with an
// explanatory comment).
export const REQUIRED_ENV_VARS = [
  "POSTGRES_USER",
  "POSTGRES_DB",
  "POSTGRES_PASSWORD",
  "FIBER_SECRET_KEY_PASSWORD",
  "DOMAIN",
  "CERTBOT_EMAIL",
  "ADMIN_PASSWORD_HASH_B64",
  "DASHBOARD_SESSION_SECRET",
  "FIBERGATE_INTERNAL_SECRET",
  "WEBHOOK_SECRET_ENCRYPTION_KEY",
  "GHCR_NAMESPACE",
] as const;

export function buildEnvFile(template: string, values: Record<string, string>): string {
  const lines = template.split("\n");
  const remaining = new Set(Object.keys(values));

  const result = lines.map((line) => {
    const match = line.match(VAR_LINE);
    if (!match) return line;
    const [, name] = match;
    if (!(name in values)) return line;
    remaining.delete(name);
    return `${name}=${values[name]}`;
  });

  if (remaining.size > 0) {
    throw new Error(
      `.env.release.example template is missing expected var(s): ${[...remaining].join(", ")}`,
    );
  }

  return result.join("\n");
}
