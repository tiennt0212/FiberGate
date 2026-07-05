import { randomBytes } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { webhookDeliveries, webhookEndpoints } from "@/lib/db/schema";
import { encryptWebhookSecret } from "@/lib/webhooks/secret-crypto";
import type { WebhookEvent } from "@/lib/webhooks/trigger";
import { cancelScheduledAttempt, scheduleAttempt } from "@/lib/webhooks/retry-scheduler";

// Service-layer CRUD for webhook_endpoints + resendDelivery(), following the
// same split as lib/services/invoices.ts: route/Server-Action code (a future
// Dashboard Pages issue, per Resolved Decision #6 — no /api/v1/webhooks*
// route this iteration) calls into these functions rather than writing its
// own Drizzle queries. The delivery *engine* itself (trigger/deliver/retry-
// scheduler) is the poller-style exception CLAUDE.md carves out for
// background-job code and queries the DB directly.

// webhook_endpoints/webhook_deliveries have no dedicated row types exported
// from lib/db/schema.ts yet (only InvoiceRow is) — declared here via
// Drizzle's own $inferSelect rather than editing schema.ts for a type-only
// addition outside this issue's scope.
export type WebhookEndpointRow = typeof webhookEndpoints.$inferSelect;
export type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect;

// BR-SEC-003: webhook secret must be random and >= 32 bytes. Mirrors the
// randomBytes(32) precedent in lib/fiber/client.ts's preimage generation.
const WEBHOOK_SECRET_BYTES = 32;

export interface CreateWebhookEndpointInput {
  url: string;
  events: WebhookEvent[];
}

export interface CreateWebhookEndpointResult {
  endpoint: WebhookEndpointRow;
  /**
   * Plaintext secret, returned exactly once at creation time so the caller
   * can hand it to the merchant to configure their verification code — the
   * DB only ever stores the encrypted form (BR-SEC-003 + Resolved Decision
   * #1). There is no way to recover this value again after this call
   * returns; a lost secret means creating a new endpoint.
   */
  secret: string;
}

export async function createWebhookEndpoint(
  input: CreateWebhookEndpointInput,
): Promise<CreateWebhookEndpointResult> {
  const plaintextSecret = randomBytes(WEBHOOK_SECRET_BYTES).toString("hex");
  const encryptedSecret = encryptWebhookSecret(plaintextSecret);

  const insertedRows = await db
    .insert(webhookEndpoints)
    .values({
      url: input.url,
      secret: encryptedSecret,
      events: input.events,
      isActive: true,
    })
    .returning();

  const endpoint = insertedRows[0];
  if (!endpoint) {
    console.error("Webhook endpoint insert returned no row");
    throw new Error("Webhook endpoint insert returned no row");
  }

  return { endpoint, secret: plaintextSecret };
}

export async function listWebhookEndpoints(): Promise<WebhookEndpointRow[]> {
  return db.select().from(webhookEndpoints).orderBy(desc(webhookEndpoints.createdAt));
}

export interface UpdateWebhookEndpointInput {
  url?: string;
  events?: WebhookEvent[];
  isActive?: boolean;
}

export async function updateWebhookEndpoint(
  id: string,
  input: UpdateWebhookEndpointInput,
): Promise<WebhookEndpointRow | null> {
  const updatedRows = await db
    .update(webhookEndpoints)
    .set({
      ...(input.url !== undefined ? { url: input.url } : {}),
      ...(input.events !== undefined ? { events: input.events } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    })
    .where(eq(webhookEndpoints.id, id))
    .returning();

  return updatedRows[0] ?? null;
}

/** Soft-deactivate (is_active = false) — never hard-deletes an endpoint. */
export async function deactivateWebhookEndpoint(id: string): Promise<WebhookEndpointRow | null> {
  const updatedRows = await db
    .update(webhookEndpoints)
    .set({ isActive: false })
    .where(eq(webhookEndpoints.id, id))
    .returning();

  return updatedRows[0] ?? null;
}

/**
 * Resend a failed delivery (US-003). Resolved Decision #7: creates a
 * brand-new webhook_deliveries row (append-only audit log — the original
 * failed row is never mutated) reusing the ORIGINAL row's `payload` value
 * byte-for-byte (so the re-signed HMAC covers the identical bytes the
 * merchant would have received the first time, and the payload's
 * `created_at` still reflects the original event time, not the resend
 * time), with its own independent attempt cycle starting at attempt 1.
 */
export async function resendDelivery(deliveryId: string): Promise<WebhookDeliveryRow> {
  const originalRows = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);
  const original = originalRows[0];
  if (!original) {
    throw new Error(`resendDelivery: no webhook_deliveries row for id ${deliveryId}`);
  }

  // Guard against the (normally-impossible, since a delivery only reaches
  // status='failed' once its own retry chain is exhausted) race where the
  // original delivery still has an armed retry timer when a resend is
  // requested.
  cancelScheduledAttempt(original.id);

  const resentRows = await db
    .insert(webhookDeliveries)
    .values({
      endpointId: original.endpointId,
      invoiceId: original.invoiceId,
      eventType: original.eventType,
      payload: original.payload,
      attemptCount: 0,
      status: "pending",
    })
    .returning();

  const resent = resentRows[0];
  if (!resent) {
    console.error("Webhook delivery resend insert returned no row");
    throw new Error("Webhook delivery resend insert returned no row");
  }

  // Non-blocking dispatch, same as trigger.ts — only the DB insert above is
  // awaited, not the HTTP delivery itself.
  scheduleAttempt(resent.id, 0);

  return resent;
}
