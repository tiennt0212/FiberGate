import type { Invoice as InvoiceRow } from "@/lib/db/schema";
import { shannonToAmount } from "./constants";

export interface InvoiceDTO {
  id: string;
  invoice_address: string;
  payment_hash: string;
  amount: number;
  asset: string;
  status: string;
  description: string | null;
  paid_at: string | null;
  expires_at: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

/** DB row → public API shape (see rest-api-spec.md). */
export function toInvoiceDTO(row: InvoiceRow): InvoiceDTO {
  return {
    id: row.id,
    invoice_address: row.invoiceAddress,
    payment_hash: row.paymentHash,
    amount: shannonToAmount(row.amountShannon),
    asset: row.asset,
    status: row.status,
    description: row.description ?? null,
    paid_at: row.paidAt ? row.paidAt.toISOString() : null,
    expires_at: row.expiresAt.toISOString(),
    created_at: row.createdAt.toISOString(),
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  };
}
