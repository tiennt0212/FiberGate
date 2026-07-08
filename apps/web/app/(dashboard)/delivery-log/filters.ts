import type { WebhookDeliveryStatus } from "@/lib/webhooks/deliver";

// Shared between delivery-log/page.tsx (table filter) and
// delivery-log/actions.ts (CSV export) — both need to parse the `status`
// query param the same way so the on-page filtered view and the CSV export
// never disagree about which rows match.

export function isDeliveryStatus(value: string | undefined): value is WebhookDeliveryStatus {
  return value === "pending" || value === "success" || value === "failed";
}
