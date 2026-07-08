import { shannonToCkb } from "@/lib/api/format";
import type { InvoiceRow } from "@/lib/db/schema";

// Plain (non-"use server") shaping helper, following the EndpointView
// pattern in webhooks/view-types.ts. InvoiceRow.amountShannon is a bigint,
// and React/Next's RSC flight serialization for Server -> Client Component
// props does not support BigInt (unlike Date/string) — see
// invoices/actions.ts's comment on the analogous Server Action boundary.
// Every "use client" component that renders InvoiceRow data (InvoicesTable,
// Overview's Recent Invoices table) must be handed this view shape instead
// of the raw row. Lives at the (dashboard)/ root (not under invoices/)
// because both the invoices/ and dashboard/ routes need it.

export interface InvoiceView {
  id: string;
  description: string | null;
  amountCkb: number;
  asset: string;
  status: string;
  invoiceAddress: string;
  createdAt: string | null;
}

export function toInvoiceView(row: InvoiceRow): InvoiceView {
  return {
    id: row.id,
    description: row.description,
    amountCkb: shannonToCkb(row.amountShannon),
    asset: row.asset,
    status: row.status,
    invoiceAddress: row.invoiceAddress,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  };
}
