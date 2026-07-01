"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { webhookEndpoints } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/auth/guard";
import { encryptSecret } from "@/lib/crypto/secretbox";
import { generateWebhookSecret } from "@/lib/webhooks/signing";
import { retryDelivery } from "@/lib/webhooks/delivery";

const ALLOWED_EVENTS = ["payment.paid", "invoice.expired", "invoice.failed", "*"];

export interface CreateEndpointResult {
  ok: boolean;
  error?: string;
  id?: string;
  secret?: string;
}

/** US-003: add a webhook endpoint. Returns the plaintext secret once for the admin to copy. */
export async function createWebhookEndpoint(input: {
  url: string;
  events: string[];
}): Promise<CreateEndpointResult> {
  await requireAdminSession();

  const url = input.url?.trim() ?? "";
  if (!/^https?:\/\/.+/i.test(url)) {
    return { ok: false, error: "URL must start with http:// or https://" };
  }
  const events = input.events.filter((e) => ALLOWED_EVENTS.includes(e));
  if (events.length === 0) {
    return { ok: false, error: "Select at least one event" };
  }

  const secret = generateWebhookSecret();
  const [row] = await db
    .insert(webhookEndpoints)
    .values({ url, secret: encryptSecret(secret), events, isActive: true })
    .returning({ id: webhookEndpoints.id });

  revalidatePath("/webhooks");
  return { ok: true, id: row?.id, secret };
}

export async function setWebhookActive(id: string, isActive: boolean): Promise<void> {
  await requireAdminSession();
  await db.update(webhookEndpoints).set({ isActive }).where(eq(webhookEndpoints.id, id));
  revalidatePath("/webhooks");
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  await requireAdminSession();
  await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));
  revalidatePath("/webhooks");
}

export async function retryWebhookDelivery(id: string): Promise<{ ok: boolean }> {
  await requireAdminSession();
  const ok = await retryDelivery(id);
  revalidatePath("/webhooks");
  return { ok };
}
