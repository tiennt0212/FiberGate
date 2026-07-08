import { listWebhookEndpoints } from "@/lib/services/webhooks";

import { WebhooksPanel } from "./webhooks-panel";
import { toEndpointView } from "./view-types";

// Server Component — reads the service layer directly (CLAUDE.md pattern).
// All mutations (create/toggle/regenerate) and the per-endpoint delivery
// history fetch live in actions.ts's Server Actions, called from
// webhooks-panel.tsx.
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

  return <WebhooksPanel initialEndpoints={endpoints} error={error} />;
}
