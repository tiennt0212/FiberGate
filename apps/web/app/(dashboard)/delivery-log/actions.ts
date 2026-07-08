"use server";

import { listWebhookDeliveries, resendDelivery } from "@/lib/services/webhooks";

import { CSV_PAGE_SIZE, exportRowsToCsv, parseDateEnd, parseDateStart } from "../search-params";

import { isDeliveryStatus } from "./filters";

// Server Actions for the Delivery Log page (issue #10). Retry re-uses
// resendDelivery() unchanged — BR-WHK-006's retryable/non-retryable
// classification stays owned by lib/webhooks/deliver.ts, never reimplemented
// here.

export interface DeliveryLogCsvFilters {
  endpointId?: string;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
}

export async function exportDeliveryLogCsv(filters: DeliveryLogCsvFilters): Promise<string> {
  return exportRowsToCsv(
    ["Invoice ID", "Event", "Endpoint", "HTTP Status", "Delivery Status", "Delivered/Created At"],
    (cursor) =>
      listWebhookDeliveries({
        limit: CSV_PAGE_SIZE,
        cursor,
        endpointId: filters.endpointId || undefined,
        status: isDeliveryStatus(filters.status) ? filters.status : undefined,
        search: filters.search || undefined,
        createdFrom: parseDateStart(filters.from),
        createdTo: parseDateEnd(filters.to),
      }),
    (row) => [
      row.invoiceId ?? "",
      row.eventType,
      row.endpointUrl ?? "",
      row.httpStatus !== null ? String(row.httpStatus) : "",
      row.status,
      (row.deliveredAt ?? row.createdAt)?.toISOString() ?? "",
    ],
  );
}

export interface RetryDeliveryResult {
  ok: boolean;
  error?: string;
}

/** Wraps resendDelivery() with explicit success/error reporting for the client's Retry button. */
export async function retryDelivery(deliveryId: string): Promise<RetryDeliveryResult> {
  try {
    await resendDelivery(deliveryId);
    return { ok: true };
  } catch (error) {
    console.error("Delivery Log: retryDelivery failed:", error);
    return { ok: false, error: "Could not retry this delivery." };
  }
}
