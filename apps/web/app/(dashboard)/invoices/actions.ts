"use server";

import { shannonToCkb } from "@/lib/api/format";
import { getInvoiceById, listInvoices } from "@/lib/services/invoices";
import { listWebhookDeliveries } from "@/lib/services/webhooks";

import { toDeliveryView, type DeliveryView } from "../delivery-view";
import { CSV_PAGE_SIZE, exportRowsToCsv, parseDateEnd, parseDateStart } from "../search-params";

import { isInvoiceAsset, isInvoiceStatus, parseAmountShannon } from "./filters";

// Server Actions for the Invoices page (issue #10). Arguments/return values
// are kept to plain JSON-safe types (string/number/boolean/null) throughout
// — bigint (InvoiceRow.amountShannon) and Date never cross this boundary,
// since React Server Actions' serialization does not support bigint.

export interface InvoiceCsvFilters {
  status?: string;
  asset?: string;
  search?: string;
  /** yyyy-mm-dd, from the filter bar's <input type="date">. */
  from?: string;
  to?: string;
  /** CKB amount as typed by the user (not shannon). */
  min?: string;
  max?: string;
}

/** Exports every invoice matching the current filter bar (not just the visible page) as CSV text. */
export async function exportInvoicesCsv(filters: InvoiceCsvFilters): Promise<string> {
  return exportRowsToCsv(
    ["Invoice ID", "Description", "Amount", "Asset", "Status", "Created At"],
    (cursor) =>
      listInvoices({
        limit: CSV_PAGE_SIZE,
        cursor,
        status: isInvoiceStatus(filters.status) ? filters.status : undefined,
        asset: isInvoiceAsset(filters.asset) ? filters.asset : undefined,
        search: filters.search || undefined,
        createdFrom: parseDateStart(filters.from),
        createdTo: parseDateEnd(filters.to),
        amountMinShannon: parseAmountShannon(filters.min),
        amountMaxShannon: parseAmountShannon(filters.max),
      }),
    (row) => [
      row.id,
      row.description ?? "",
      String(shannonToCkb(row.amountShannon)),
      row.asset,
      row.status,
      row.createdAt ? row.createdAt.toISOString() : "",
    ],
  );
}

export interface InvoiceReceipt {
  id: string;
  description: string | null;
  amountCkb: number;
  asset: string;
  status: string;
  paymentHash: string;
  invoiceAddress: string;
  createdAt: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  deliveries: DeliveryView[];
}

/** Invoice detail + its webhook delivery history, for the Invoices page's "Receipt" drawer. */
export async function getInvoiceReceipt(id: string): Promise<InvoiceReceipt | null> {
  // Independent reads (the deliveries query only filters by invoiceId, not
  // on anything from the invoice row itself) — run in parallel rather than
  // sequentially.
  const [invoice, { rows }] = await Promise.all([getInvoiceById(id), listWebhookDeliveries({ invoiceId: id, limit: 20 })]);
  if (!invoice) {
    return null;
  }

  return {
    id: invoice.id,
    description: invoice.description,
    amountCkb: shannonToCkb(invoice.amountShannon),
    asset: invoice.asset,
    status: invoice.status,
    paymentHash: invoice.paymentHash,
    invoiceAddress: invoice.invoiceAddress,
    createdAt: invoice.createdAt ? invoice.createdAt.toISOString() : null,
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    expiresAt: invoice.expiresAt.toISOString(),
    deliveries: rows.map(toDeliveryView),
  };
}
