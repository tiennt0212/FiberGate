import { shannonToCkb } from "@/lib/api/format";
import type { InvoiceRow } from "@/lib/db/schema";

// Shared row->JSON mapping for GET /invoices, GET /invoices/:id, and (minus
// paid_at) POST /invoices — all three expose the same invoice shape.
export function serializeInvoice(row: InvoiceRow) {
  return {
    id: row.id,
    invoice_address: row.invoiceAddress,
    payment_hash: row.paymentHash,
    amount: shannonToCkb(row.amountShannon),
    asset: row.asset,
    status: row.status,
    paid_at: row.paidAt ? row.paidAt.toISOString() : null,
    expires_at: row.expiresAt.toISOString(),
    created_at: (row.createdAt ?? new Date()).toISOString(),
  };
}

// POST /invoices response omits paid_at (always null at creation time) to
// match the exact shape in .context/api/rest-api-spec.md's 201 example.
export function serializeCreatedInvoice(row: InvoiceRow) {
  const { paid_at: _paidAt, ...rest } = serializeInvoice(row);
  return rest;
}
