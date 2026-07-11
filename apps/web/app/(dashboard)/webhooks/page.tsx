import { getWebhookDeliveryHealth, listWebhookEndpoints, type WebhookDeliveryHealth } from "@/lib/services/webhooks";

import { WebhooksPanel } from "./webhooks-panel";
import { toEndpointView } from "./view-types";

// Server Component — reads the service layer directly (CLAUDE.md pattern).
// All mutations (create/toggle/regenerate) and the per-endpoint delivery
// history fetch live in actions.ts's Server Actions, called from
// webhooks-panel.tsx. Delivery health (issue #40) is read-only and cheap
// enough to fetch alongside the endpoint list on every page load, unlike
// those — no Server Action needed for it. The two loads are independent, so
// they run in parallel (same Promise.all pattern as overview/page.tsx)
// rather than paying both round-trips back to back.

async function loadEndpoints(): Promise<{ endpoints: ReturnType<typeof toEndpointView>[]; error: string | null }> {
  try {
    const rows = await listWebhookEndpoints();
    return { endpoints: rows.map(toEndpointView), error: null };
  } catch (fetchError) {
    console.error("Webhooks: listWebhookEndpoints failed:", fetchError);
    return { endpoints: [], error: "Could not load webhook endpoints." };
  }
}

async function loadHealth(): Promise<{ health: WebhookDeliveryHealth | null; healthError: string | null }> {
  try {
    return { health: await getWebhookDeliveryHealth(), healthError: null };
  } catch (fetchError) {
    console.error("Webhooks: getWebhookDeliveryHealth failed:", fetchError);
    return { health: null, healthError: "Could not load delivery health." };
  }
}

export default async function WebhooksPage() {
  const [{ endpoints, error }, { health, healthError }] = await Promise.all([loadEndpoints(), loadHealth()]);

  return <WebhooksPanel initialEndpoints={endpoints} error={error} health={health} healthError={healthError} />;
}
