export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

// Non-throwing accessor for env vars that are documented as optional (e.g.
// CRON_SECRET — system-design.md "Environment Variables"). Returns
// `undefined` instead of throwing so callers can implement their own
// "not configured" behavior (e.g. POST /api/cron/poll-invoices returning
// 503) rather than a hard crash. requireEnv() above stays unchanged and
// keeps throwing for FIBERGATE_INTERNAL_SECRET and other required vars.
export function getOptionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}
