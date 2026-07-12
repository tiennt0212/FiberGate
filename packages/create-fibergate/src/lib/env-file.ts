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

// Walks backward from a VAR= line through its immediately preceding block of
// "#"-comment lines, looking for a "[REQUIRED]" marker (see
// .env.release.example's own comment convention) — stops at the first
// non-comment line.
function isMarkedRequired(lines: string[], varLineIndex: number): boolean {
  for (let i = varLineIndex - 1; i >= 0 && lines[i].startsWith("#"); i--) {
    if (lines[i].includes("[REQUIRED]")) return true;
  }
  return false;
}

export function buildEnvFile(template: string, values: Record<string, string>): string {
  const lines = template.split("\n");
  const remaining = new Set(Object.keys(values));
  const missingRequired: string[] = [];

  const result = lines.map((line, i) => {
    const match = line.match(VAR_LINE);
    if (!match) return line;
    const [, name] = match;
    if (!(name in values)) {
      // Two-directional drift guard: catches not just "the wizard expects a
      // var the template doesn't have" (below) but also the reverse — a var
      // the template marks [REQUIRED] that the wizard forgot to supply,
      // which would otherwise pass through silently blank.
      if (isMarkedRequired(lines, i)) missingRequired.push(name);
      return line;
    }
    remaining.delete(name);
    return `${name}=${values[name]}`;
  });

  const errors: string[] = [];
  if (remaining.size > 0) {
    errors.push(`wizard supplied var(s) missing from the template: ${[...remaining].join(", ")}`);
  }
  if (missingRequired.length > 0) {
    errors.push(`template marks var(s) [REQUIRED] with no value supplied: ${missingRequired.join(", ")}`);
  }
  if (errors.length > 0) {
    throw new Error(`.env.release.example and the wizard are out of sync — ${errors.join("; ")}`);
  }

  return result.join("\n");
}
