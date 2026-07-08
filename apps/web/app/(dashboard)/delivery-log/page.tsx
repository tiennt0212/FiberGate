import { listWebhookDeliveries, listWebhookEndpoints, type WebhookDeliveryListItem } from "@/lib/services/webhooks";

import { firstParam, parseDateEnd, parseDateStart, walkToPage } from "../search-params";

import { DeliveryLogTable } from "./delivery-log-table";
import { isDeliveryStatus } from "./filters";

const PAGE_SIZE = 10;

export default async function DeliveryLogPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const endpointId = firstParam(searchParams.endpoint) ?? "";
  const statusParam = firstParam(searchParams.status);
  const q = firstParam(searchParams.q) ?? "";
  const from = firstParam(searchParams.from) ?? "";
  const to = firstParam(searchParams.to) ?? "";
  const page = Math.max(0, Number(firstParam(searchParams.page)) || 0);

  const filters = {
    endpointId: endpointId || undefined,
    status: isDeliveryStatus(statusParam) ? statusParam : undefined,
    search: q || undefined,
    createdFrom: parseDateStart(from),
    createdTo: parseDateEnd(to),
  };

  let rows: WebhookDeliveryListItem[] = [];
  let hasNextPage = false;
  let resolvedPage = 0;
  let error: string | null = null;
  let endpointOptions: { label: string; value: string }[] = [];

  try {
    const [pageResult, endpoints] = await Promise.all([
      walkToPage<WebhookDeliveryListItem>((cursor) => listWebhookDeliveries({ ...filters, limit: PAGE_SIZE, cursor }), page),
      listWebhookEndpoints(),
    ]);
    rows = pageResult.rows;
    hasNextPage = pageResult.hasNextPage;
    resolvedPage = pageResult.resolvedPage;
    endpointOptions = endpoints.map((endpoint) => ({ label: endpoint.url, value: endpoint.id }));
  } catch (fetchError) {
    console.error("Delivery Log: failed to load deliveries:", fetchError);
    error = "Could not load the delivery log.";
  }

  return (
    <DeliveryLogTable
      rows={rows}
      page={resolvedPage}
      hasNextPage={hasNextPage}
      endpointOptions={endpointOptions}
      filters={{ endpoint: endpointId, status: statusParam ?? "all", q, from, to }}
      error={error}
    />
  );
}
