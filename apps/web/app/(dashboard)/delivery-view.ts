import type { WebhookDeliveryListItem } from "@/lib/services/webhooks";

// Plain (non-"use server") shaping helper, following invoice-view.ts's
// pattern. Lives at the (dashboard)/ root because both invoices/actions.ts
// (an invoice receipt's delivery history) and webhooks/actions.ts (an
// endpoint's delivery history) need the same
// WebhookDeliveryListItem -> display shape mapping.

export interface DeliveryView {
  id: string;
  eventType: string;
  endpointUrl: string | null;
  httpStatus: number | null;
  status: string;
  deliveredAt: string | null;
  createdAt: string | null;
}

export function toDeliveryView(row: WebhookDeliveryListItem): DeliveryView {
  return {
    id: row.id,
    eventType: row.eventType,
    endpointUrl: row.endpointUrl,
    httpStatus: row.httpStatus,
    status: row.status,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  };
}
