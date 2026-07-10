import { getWebhookDeliveryHealth, listWebhookEndpoints, type WebhookDeliveryHealth } from "@/lib/services/webhooks";

import { WebhooksPanel } from "./webhooks-panel";
import { toEndpointView } from "./view-types";

// Server Component — reads the service layer directly (CLAUDE.md pattern).
// All mutations (create/toggle/regenerate) and the per-endpoint delivery
// history fetch live in actions.ts's Server Actions, called from
// webhooks-panel.tsx. Delivery health (issue #40) is read-only and cheap
// enough to fetch alongside the endpoint list on every page load, unlike
// those — no Server Action needed for it.
export default async function WebhooksPage() {
  let endpoints: ReturnType<typeof toEndpointView>[] = [];
  let error: string | null = null;
  try {
    const rows = await listWebhookEndpoints();
    endpoints = rows.map(toEndpointView);
  } catch (fetchError) {
    console.error("Webhooks: listWebhookEndpoints failed:", fetchError);
    error = "Could not load webhook endpoints.";
  }

  let health: WebhookDeliveryHealth | null = null;
  try {
    health = await getWebhookDeliveryHealth();
  } catch (healthError) {
    console.error("Webhooks: getWebhookDeliveryHealth failed:", healthError);
  }

  return <WebhooksPanel initialEndpoints={endpoints} error={error} health={health} />;
}
