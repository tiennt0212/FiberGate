import { getDeliveries, getEndpointsWithStats } from "@/lib/dashboard/queries";
import {
  WebhooksClient,
  type DeliveryDTO,
  type EndpointDTO,
} from "@/components/webhooks/WebhooksClient";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const [endpointRows, deliveryRows] = await Promise.all([
    getEndpointsWithStats(),
    getDeliveries(200),
  ]);

  const endpoints: EndpointDTO[] = endpointRows.map((e) => ({
    id: e.id,
    url: e.url,
    events: e.events,
    isActive: e.isActive,
    createdAt: e.createdAt.toISOString(),
    totalDeliveries: e.totalDeliveries,
    successDeliveries: e.successDeliveries,
    lastDeliveryAt: e.lastDeliveryAt ? e.lastDeliveryAt.toISOString() : null,
  }));

  const deliveries: DeliveryDTO[] = deliveryRows.map((d) => ({
    id: d.id,
    endpointId: d.endpointId,
    invoiceId: d.invoiceId,
    eventType: d.eventType,
    httpStatus: d.httpStatus,
    status: d.status,
    attemptCount: d.attemptCount,
    createdAt: d.createdAt.toISOString(),
    deliveredAt: d.deliveredAt ? d.deliveredAt.toISOString() : null,
  }));

  return <WebhooksClient endpoints={endpoints} deliveries={deliveries} />;
}
