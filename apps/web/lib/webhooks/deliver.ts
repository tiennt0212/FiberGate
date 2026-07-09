import { eq } from "drizzle-orm";

import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { webhookDeliveries, webhookEndpoints, type WebhookDeliveryRow } from "@/lib/db/schema";

import { decryptWebhookSecret } from "./secret-crypto";
import { signWebhookPayload } from "./sign";
import { scheduleAttempt } from "./retry-scheduler";

// One HTTP delivery attempt for a given webhook_deliveries row, plus
// persisting its outcome (BR-WHK-005: every attempt, success or failure).
// Called by retry-scheduler.ts's armed setTimeout callbacks — never called
// directly by trigger.ts (which only inserts the row and arms the first,
// "immediate" attempt via scheduleAttempt(id, 0)).

const DELIVERY_TIMEOUT_MS = 5000; // BR-WHK-002
const RESPONSE_BODY_MAX_BYTES = 1024; // BR-WHK-005 "1KB"
const MAX_ATTEMPTS = 3; // BR-WHK-003
// Delay before attempt N+1, indexed by (attemptNumber - 1) of the attempt
// that just failed retryably: attempt 1 fails -> +60s (attempt 2), attempt 2
// fails -> +300s (attempt 3). BR-WHK-003.
const RETRY_DELAYS_MS = [60_000, 300_000];

export type WebhookDeliveryStatus = "pending" | "success" | "failed";

/**
 * Truncates a response body to at most RESPONSE_BODY_MAX_BYTES bytes without
 * splitting a multi-byte UTF-8 sequence in half — walks back over any
 * trailing continuation bytes (0b10xxxxxx) rather than emitting a
 * replacement character for a half-decoded code point.
 */
function truncateResponseBody(body: string): string {
  const buf = Buffer.from(body, "utf8");
  if (buf.length <= RESPONSE_BODY_MAX_BYTES) {
    return body;
  }

  let end = RESPONSE_BODY_MAX_BYTES;
  while (end > 0 && (buf[end]! & 0xc0) === 0x80) {
    end -= 1;
  }

  return buf.subarray(0, end).toString("utf8");
}

type DeliveryOutcome = "success" | "retryable" | "non-retryable";

/**
 * Classifies an HTTP response per Resolved Decision #4: 2xx/3xx (response.ok)
 * is success; 5xx and 429 are retryable; any other non-ok status (other
 * 4xx) is non-retryable.
 */
function classifyResponse(response: Response): DeliveryOutcome {
  if (response.ok) {
    return "success";
  }
  if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
    return "retryable";
  }
  return "non-retryable";
}

function markDeliveryFailed(deliveryId: string): Promise<unknown> {
  return db.update(webhookDeliveries).set({ status: "failed" }).where(eq(webhookDeliveries.id, deliveryId));
}

export async function attemptDelivery(deliveryId: string): Promise<void> {
  const deliveryRows = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);
  const delivery: WebhookDeliveryRow | undefined = deliveryRows[0];
  if (!delivery) {
    logActivity("error", "webhook", `attemptDelivery: no webhook_deliveries row for id ${deliveryId}; skipping`);
    return;
  }

  if (!delivery.endpointId) {
    logActivity("error", "webhook", `attemptDelivery: delivery ${deliveryId} has no endpoint_id; marking failed`);
    await markDeliveryFailed(deliveryId);
    return;
  }

  const endpointRows = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, delivery.endpointId))
    .limit(1);
  const endpoint = endpointRows[0];
  if (!endpoint) {
    logActivity(
      "error",
      "webhook",
      `attemptDelivery: no webhook_endpoints row for id ${delivery.endpointId}; marking delivery ${deliveryId} failed`,
    );
    await markDeliveryFailed(deliveryId);
    return;
  }

  // Byte-exact signing: JSON.stringify() on the payload object read back
  // from the jsonb column, never a value re-derived from the invoice.
  // Postgres jsonb normalizes key order on write, so re-serializing the
  // same stored object on every attempt (first try, each retry, and resend)
  // reproduces identical bytes each time.
  const rawBody = JSON.stringify(delivery.payload);

  let decryptedSecret: string;
  try {
    decryptedSecret = decryptWebhookSecret(endpoint.secret);
  } catch (error) {
    logActivity("error", "webhook", `Failed to decrypt secret for endpoint ${endpoint.id}: ${String(error)}`);
    await markDeliveryFailed(deliveryId);
    return;
  }

  const signature = signWebhookPayload(rawBody, decryptedSecret);
  const attemptNumber = (delivery.attemptCount ?? 0) + 1;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  let httpStatus: number | null = null;
  let responseBody: string | null = null;
  let outcome: DeliveryOutcome;

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Fiber-Signature": signature,
      },
      body: rawBody,
      signal: controller.signal,
    });
    httpStatus = response.status;
    const text = await response.text();
    responseBody = truncateResponseBody(text);
    outcome = classifyResponse(response);
  } catch (error) {
    // A real abort (timeout, BR-WHK-002) and any network-level failure
    // (DNS/connect refused/reset) both land here — both retryable per
    // Resolved Decision #4. There is no HTTP status in either case.
    httpStatus = null;
    responseBody = error instanceof Error ? truncateResponseBody(error.message) : null;
    outcome = "retryable";
  } finally {
    clearTimeout(timeoutHandle);
  }

  const now = new Date();
  let status: WebhookDeliveryStatus;
  let nextRetryAt: Date | null = null;
  let nextDelayMs: number | null = null;

  if (outcome === "success") {
    status = "success";
  } else if (outcome === "retryable" && attemptNumber < MAX_ATTEMPTS) {
    status = "pending";
    nextDelayMs = RETRY_DELAYS_MS[attemptNumber - 1]!;
    nextRetryAt = new Date(now.getTime() + nextDelayMs);
  } else {
    // Either non-retryable (any other 4xx), or retryable but the 3-attempt
    // cap (BR-WHK-003) is already reached — no further attempt either way.
    status = "failed";
  }

  // BR-WHK-005: persist this attempt regardless of outcome.
  await db
    .update(webhookDeliveries)
    .set({
      httpStatus,
      responseBody,
      attemptCount: attemptNumber,
      status,
      nextRetryAt,
      ...(status === "success" ? { deliveredAt: now } : {}),
    })
    .where(eq(webhookDeliveries.id, deliveryId));

  logActivity(
    status === "failed" ? "error" : "info",
    "webhook",
    `delivery ${deliveryId} to ${endpoint.url} attempt ${attemptNumber}/${MAX_ATTEMPTS}: ` +
      `${outcome} (http ${httpStatus ?? "n/a"}) -> ${status}${nextRetryAt ? `, retrying at ${nextRetryAt.toISOString()}` : ""}`,
  );

  if (nextDelayMs !== null) {
    scheduleAttempt(deliveryId, nextDelayMs);
  }
}
