import { randomBytes } from "node:crypto";

import { and, desc, eq, gte, ilike, lt, lte, or, sql, type SQL } from "drizzle-orm";

import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { decodeCursor as decodeDeliveryCursor, encodeCursor as encodeDeliveryCursor } from "@/lib/db/cursor";
import {
  invoices,
  webhookDeliveries,
  webhookEndpoints,
  type WebhookDeliveryRow,
  type WebhookEndpointRow,
} from "@/lib/db/schema";
import type { WebhookDeliveryStatus } from "@/lib/webhooks/deliver";
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

function logAndThrow(message: string): never {
  console.error(message);
  throw new Error(message);
}

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
    logAndThrow("Webhook endpoint insert returned no row");
  }

  return { endpoint, secret: plaintextSecret };
}

export async function listWebhookEndpoints(): Promise<WebhookEndpointRow[]> {
  return db.select().from(webhookEndpoints).orderBy(desc(webhookEndpoints.createdAt));
}

export interface RegenerateWebhookSecretResult {
  endpoint: WebhookEndpointRow;
  /**
   * Plaintext secret, returned exactly once — same one-time-reveal contract
   * as CreateWebhookEndpointResult.secret above (harness-brief.md issue #10
   * Resolved Decision #1: the Webhooks page shows a masked placeholder plus
   * a "Regenerate secret" action instead of the mockup's persistent
   * reveal/copy button, to keep issue #8's "shown once, never recoverable"
   * security posture). The endpoint's OLD secret stops verifying signatures
   * the instant this call succeeds — there is no grace period.
   */
  secret: string;
}

/** Issues a brand-new random secret for an existing endpoint, replacing the old one. */
export async function regenerateWebhookSecret(id: string): Promise<RegenerateWebhookSecretResult> {
  const plaintextSecret = randomBytes(WEBHOOK_SECRET_BYTES).toString("hex");
  const encryptedSecret = encryptWebhookSecret(plaintextSecret);

  const updatedRows = await db
    .update(webhookEndpoints)
    .set({ secret: encryptedSecret })
    .where(eq(webhookEndpoints.id, id))
    .returning();

  const endpoint = updatedRows[0];
  if (!endpoint) {
    throw new Error(`regenerateWebhookSecret: no webhook_endpoints row for id ${id}`);
  }

  return { endpoint, secret: plaintextSecret };
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
    logAndThrow("Webhook delivery resend insert returned no row");
  }

  logActivity("info", "webhook", `queued 1 delivery for invoice ${resent.invoiceId} (event: ${resent.eventType}, manual resend of ${deliveryId})`);

  // Non-blocking dispatch, same as trigger.ts — only the DB insert above is
  // awaited, not the HTTP delivery itself.
  scheduleAttempt(resent.id, 0);

  return resent;
}

// --- Delivery Log (issue #10) --------------------------------------------
// Joined, cursor-paginated read query over webhook_deliveries for the
// dashboard's Delivery Log page. Shares lib/db/cursor.ts's (createdAt, id)
// codec with lib/services/invoices.ts's listInvoices() so both list pages
// behave identically.

export interface ListWebhookDeliveriesQuery {
  endpointId?: string;
  invoiceId?: string;
  status?: WebhookDeliveryStatus;
  /** Case-insensitive substring match against the related invoice's id or payment_hash. */
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
  limit: number;
  cursor?: string;
}

export interface WebhookDeliveryListItem {
  id: string;
  invoiceId: string | null;
  eventType: string;
  endpointId: string | null;
  endpointUrl: string | null;
  httpStatus: number | null;
  // webhook_deliveries.status (BR-WHK-006 classification owned by
  // lib/webhooks/deliver.ts) — pending/success/failed, never re-derived here.
  status: string;
  attemptCount: number | null;
  deliveredAt: Date | null;
  createdAt: Date | null;
}

export interface ListWebhookDeliveriesResult {
  rows: WebhookDeliveryListItem[];
  nextCursor: string | null;
}

// Cursor codec shared with invoices.ts via lib/db/cursor.ts (imported above
// as decode/encodeDeliveryCursor) — both list queries paginate on the same
// (createdAt, id) compound key.

export async function listWebhookDeliveries(
  query: ListWebhookDeliveriesQuery,
): Promise<ListWebhookDeliveriesResult> {
  const conditions: SQL[] = [];
  if (query.endpointId) {
    conditions.push(eq(webhookDeliveries.endpointId, query.endpointId));
  }
  if (query.invoiceId) {
    conditions.push(eq(webhookDeliveries.invoiceId, query.invoiceId));
  }
  if (query.status) {
    conditions.push(eq(webhookDeliveries.status, query.status));
  }
  if (query.search) {
    const pattern = `%${query.search}%`;
    const searchCondition = or(ilike(sql`${invoices.id}::text`, pattern), ilike(invoices.paymentHash, pattern));
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }
  if (query.createdFrom) {
    conditions.push(gte(webhookDeliveries.createdAt, query.createdFrom));
  }
  if (query.createdTo) {
    conditions.push(lte(webhookDeliveries.createdAt, query.createdTo));
  }
  if (query.cursor) {
    const cursor = decodeDeliveryCursor(query.cursor);
    const cursorDate = new Date(cursor.createdAt);
    const cursorCondition = or(
      lt(webhookDeliveries.createdAt, cursorDate),
      and(eq(webhookDeliveries.createdAt, cursorDate), lt(webhookDeliveries.id, cursor.id)),
    );
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }
  }

  let selectQuery = db
    .select({
      id: webhookDeliveries.id,
      invoiceId: webhookDeliveries.invoiceId,
      eventType: webhookDeliveries.eventType,
      endpointId: webhookDeliveries.endpointId,
      endpointUrl: webhookEndpoints.url,
      httpStatus: webhookDeliveries.httpStatus,
      status: webhookDeliveries.status,
      attemptCount: webhookDeliveries.attemptCount,
      deliveredAt: webhookDeliveries.deliveredAt,
      createdAt: webhookDeliveries.createdAt,
    })
    .from(webhookDeliveries)
    .leftJoin(webhookEndpoints, eq(webhookDeliveries.endpointId, webhookEndpoints.id))
    .$dynamic();

  // invoices is only referenced by the `search` condition above — join it
  // conditionally so every other call (the common case) skips it entirely.
  if (query.search) {
    selectQuery = selectQuery.leftJoin(invoices, eq(webhookDeliveries.invoiceId, invoices.id));
  }

  const rows = await selectQuery
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(webhookDeliveries.createdAt), desc(webhookDeliveries.id))
    // Same "fetch one extra row" hasMore trick as listInvoices().
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  const nextCursor =
    hasMore && lastRow
      ? encodeDeliveryCursor({
          createdAt: (lastRow.createdAt ?? new Date()).toISOString(),
          id: lastRow.id,
        })
      : null;

  return { rows: pageRows, nextCursor };
}
