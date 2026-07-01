/**
 * Central, typed access to environment variables.
 * Getters throw only when *read at runtime* so that `next build` (which imports
 * modules without a full env) never crashes. Never log secret values (BR-SEC-001).
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  get internalSecret(): string {
    return required("FIBERGATE_INTERNAL_SECRET");
  },
  get adminPasswordHash(): string {
    return required("ADMIN_PASSWORD_HASH");
  },
  get sessionSecret(): string {
    return required("SESSION_SECRET");
  },
  get fiberNodeUrl(): string {
    return required("FIBER_NODE_URL");
  },
  get fiberNodeSecret(): string | undefined {
    return optional("FIBER_NODE_SECRET");
  },
  get cronSecret(): string | undefined {
    return optional("CRON_SECRET");
  },
  /** Fiber invoice currency prefix: Fibb=mainnet, Fibt=testnet, Fibd=dev. */
  get fiberCurrency(): "Fibb" | "Fibt" | "Fibd" {
    const raw = optional("FIBER_CURRENCY") ?? "Fibt";
    if (raw === "Fibb" || raw === "Fibt" || raw === "Fibd") return raw;
    throw new Error(`Invalid FIBER_CURRENCY: ${raw} (expected Fibb | Fibt | Fibd)`);
  },
  get pollIntervalMs(): number {
    const raw = optional("POLL_INTERVAL_MS");
    const n = raw ? Number(raw) : 10_000;
    return Number.isFinite(n) && n >= 1000 ? n : 10_000;
  },
  get pollerEnabled(): boolean {
    return (optional("POLLER_ENABLED") ?? "true") !== "false";
  },
} as const;
