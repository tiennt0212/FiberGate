// Invoice business constants — see .context/business-rules/payment-rules.md

export const SHANNON_PER_CKB = 100_000_000n;

// BR-INV-001
export const MIN_AMOUNT_SHANNON = 10_000_000n; // 0.1 CKB
export const MAX_AMOUNT_SHANNON = 100_000_000_000n; // 1,000 CKB

// BR-INV-003
export const DEFAULT_EXPIRY_SECONDS = 3_600;
export const MAX_EXPIRY_SECONDS = 86_400;

// BR-INV-002
export const SUPPORTED_ASSETS = ["CKB", "RUSD"] as const;
export type Asset = (typeof SUPPORTED_ASSETS)[number];

export const INVOICE_STATUSES = ["pending", "paid", "expired", "failed"] as const;
export type InvoiceStatusValue = (typeof INVOICE_STATUSES)[number];
export const TERMINAL_STATUSES: InvoiceStatusValue[] = ["paid", "expired", "failed"];

// BR-RTE-002 / list pagination
export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;

export function isSupportedAsset(value: unknown): value is Asset {
  return typeof value === "string" && (SUPPORTED_ASSETS as readonly string[]).includes(value);
}

/** BR-INV-004: shannon = round(amount * 1e8). Prototype uses the same scale for RUSD. */
export function amountToShannon(amountUnits: number): bigint {
  return BigInt(Math.round(amountUnits * Number(SHANNON_PER_CKB)));
}

export function shannonToAmount(shannon: bigint): number {
  return Number(shannon) / Number(SHANNON_PER_CKB);
}
