"use server";

import {
  createWebhookEndpoint,
  deactivateWebhookEndpoint,
  listWebhookDeliveries,
  regenerateWebhookSecret,
  updateWebhookEndpoint,
} from "@/lib/services/webhooks";
import { WebhookEvent } from "@/lib/webhooks/events";

import { toDeliveryView, type DeliveryView } from "../delivery-view";

import { toEndpointView, type EndpointView } from "./view-types";

// Server Actions for the Webhooks page (issue #10). Every return value is a
// plain JSON-safe shape (no bigint/raw Date/WebhookEndpointRow) since
// bigint isn't supported crossing the Server Action boundary, and dates are
// normalized to ISO strings to match this app's existing REST API
// convention rather than relying on RSC's Date support.
//
// Resolved Decision #1 (harness-brief.md issue #10): the plaintext secret
// from createEndpoint()/regenerateSecret() is returned to the client exactly
// once, at the moment of that call — it is never re-fetched or re-derivable
// afterward. getEndpointDeliveries() never includes it. The initial
// endpoint list itself is read directly by page.tsx (Server Component) via
// lib/services/webhooks.ts, not through this file — see view-types.ts.

export type { EndpointView };

const VALID_EVENTS = new Set<string>(Object.values(WebhookEvent));

function validateEndpointInput(url: string, events: string[]): { error: string } | { events: WebhookEvent[] } {
  if (!url.startsWith("https://")) {
    return { error: "URL must start with https://" };
  }
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    return { error: "Invalid URL format" };
  }
  const filteredEvents = events.filter((event): event is WebhookEvent => VALID_EVENTS.has(event));
  if (filteredEvents.length === 0) {
    return { error: "Select at least one event" };
  }
  return { events: filteredEvents };
}

export interface CreateEndpointResult {
  ok: boolean;
  error?: string;
  endpoint?: EndpointView;
  secret?: string;
}

export async function createEndpoint(url: string, events: string[]): Promise<CreateEndpointResult> {
  const validated = validateEndpointInput(url, events);
  if ("error" in validated) {
    return { ok: false, error: validated.error };
  }
  try {
    const result = await createWebhookEndpoint({ url, events: validated.events });
    return { ok: true, endpoint: toEndpointView(result.endpoint), secret: result.secret };
  } catch (error) {
    console.error("Webhooks: createWebhookEndpoint failed:", error);
    return { ok: false, error: "Could not create the endpoint." };
  }
}

export interface SimpleResult {
  ok: boolean;
  error?: string;
}

/**
 * Disable uses the dedicated deactivateWebhookEndpoint() (never hard-deletes
 * — BR-WHK-005 audit trail); re-enable goes through the generic
 * updateWebhookEndpoint() patch, since there's no dedicated "reactivate"
 * function and adding one for a single-field flip would just duplicate it.
 */
export async function toggleEndpointActive(id: string, nextActive: boolean): Promise<SimpleResult> {
  try {
    const updated = nextActive ? await updateWebhookEndpoint(id, { isActive: true }) : await deactivateWebhookEndpoint(id);
    return updated ? { ok: true } : { ok: false, error: "Endpoint not found." };
  } catch (error) {
    console.error("Webhooks: toggleEndpointActive failed:", error);
    return { ok: false, error: "Could not update the endpoint." };
  }
}

export interface RegenerateSecretResult {
  ok: boolean;
  error?: string;
  secret?: string;
}

export async function regenerateSecret(id: string): Promise<RegenerateSecretResult> {
  try {
    const result = await regenerateWebhookSecret(id);
    return { ok: true, secret: result.secret };
  } catch (error) {
    console.error("Webhooks: regenerateWebhookSecret failed:", error);
    return { ok: false, error: "Could not regenerate the secret." };
  }
}

export async function getEndpointDeliveries(endpointId: string): Promise<DeliveryView[]> {
  const { rows } = await listWebhookDeliveries({ endpointId, limit: 10 });
  return rows.map(toDeliveryView);
}
