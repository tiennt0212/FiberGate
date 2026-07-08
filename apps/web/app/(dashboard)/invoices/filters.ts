import { INVOICE_ASSETS, INVOICE_STATUSES, SHANNON_PER_CKB, type InvoiceAssetValue, type InvoiceStatusValue } from "@/lib/api/validation";

// Shared between invoices/page.tsx (table filter) and invoices/actions.ts
// (CSV export) — both need to parse the same filter-bar query params the
// same way so the on-page filtered view and the CSV export never disagree
// about which rows match. Invoice-specific (asset/amount are not concepts
// the Delivery Log feature has), so this lives beside the feature rather
// than in the cross-feature apps/web/app/(dashboard)/search-params.ts.

export function isInvoiceStatus(value: string | undefined): value is InvoiceStatusValue {
  return !!value && (INVOICE_STATUSES as readonly string[]).includes(value);
}

export function isInvoiceAsset(value: string | undefined): value is InvoiceAssetValue {
  return !!value && (INVOICE_ASSETS as readonly string[]).includes(value);
}

/** CKB amount as typed by the user in the filter bar -> shannon, or undefined if empty/invalid. */
export function parseAmountShannon(value: string | undefined): bigint | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? BigInt(Math.round(parsed * SHANNON_PER_CKB)) : undefined;
}
