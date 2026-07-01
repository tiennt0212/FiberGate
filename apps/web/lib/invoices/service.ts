import { and, desc, eq, lt, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { invoices } from "@/lib/db/schema";
import type { Invoice as InvoiceRow } from "@/lib/db/schema";
import { createInvoice as nodeCreateInvoice } from "@/lib/fiber/client";
import { dispatchForInvoice, eventForStatus } from "@/lib/webhooks/delivery";
import {
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  type Asset,
  type InvoiceStatusValue,
} from "./constants";

export interface CreateInvoiceInput {
  amountShannon: bigint;
  asset: Asset;
  description?: string;
  expirySeconds: number;
  metadata?: Record<string, unknown>;
}

/** Mint on the node (BR-INV-005) then persist as `pending`. */
export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceRow> {
  const minted = await nodeCreateInvoice({
    amountShannon: input.amountShannon,
    asset: input.asset,
    description: input.description,
    expirySeconds: input.expirySeconds,
  });

  const expiresAt = new Date(Date.now() + input.expirySeconds * 1000);
  const [row] = await db
    .insert(invoices)
    .values({
      paymentHash: minted.paymentHash,
      invoiceAddress: minted.invoiceAddress,
      amountShannon: input.amountShannon,
      asset: input.asset,
      description: input.description ?? null,
      status: "pending",
      expiresAt,
      metadata: input.metadata ?? null,
    })
    .returning();

  if (!row) throw new Error("Failed to persist invoice");
  return row;
}

export async function getInvoiceById(id: string): Promise<InvoiceRow | null> {
  const [row] = await db.select().from(invoices).where(eq(invoices.id, id));
  if (!row) return null;

  // BR-STS-002(b): lazily expire even if the poller hasn't run yet.
  if (row.status === "pending" && row.expiresAt.getTime() < Date.now()) {
    const expired = await transitionToTerminal(id, "expired");
    return expired ?? row;
  }
  return row;
}

export interface ListInvoicesInput {
  status?: InvoiceStatusValue;
  asset?: Asset;
  limit?: number;
  cursor?: string;
}

export interface ListInvoicesResult {
  rows: InvoiceRow[];
  nextCursor: string | null;
}

export async function listInvoices(input: ListInvoicesInput): Promise<ListInvoicesResult> {
  const limit = Math.min(Math.max(input.limit ?? LIST_DEFAULT_LIMIT, 1), LIST_MAX_LIMIT);

  const conditions = [];
  if (input.status) conditions.push(eq(invoices.status, input.status));
  if (input.asset) conditions.push(eq(invoices.asset, input.asset));

  const cursor = input.cursor ? decodeCursor(input.cursor) : null;
  if (cursor) {
    conditions.push(
      or(
        lt(invoices.createdAt, cursor.createdAt),
        and(eq(invoices.createdAt, cursor.createdAt), lt(invoices.id, cursor.id)),
      ),
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(invoices)
    .where(where)
    .orderBy(desc(invoices.createdAt), desc(invoices.id))
    .limit(limit + 1);

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const last = rows[limit - 1];
    if (last) nextCursor = encodeCursor(last.createdAt, last.id);
    rows.length = limit;
  }
  return { rows, nextCursor };
}

/**
 * Atomically move an invoice pending → terminal. The `status = 'pending'` guard
 * makes this idempotent under races (BR-STS-001): only the winning call gets a
 * row back, and only it fires the webhook (BR-WHK-001).
 */
export async function transitionToTerminal(
  id: string,
  status: Exclude<InvoiceStatusValue, "pending">,
): Promise<InvoiceRow | null> {
  const [row] = await db
    .update(invoices)
    .set({ status, paidAt: status === "paid" ? new Date() : null })
    .where(and(eq(invoices.id, id), eq(invoices.status, "pending")))
    .returning();

  if (!row) return null;

  const event = eventForStatus(status);
  if (event) {
    // Never let a webhook failure roll back the (already committed) status change.
    await dispatchForInvoice(row, event).catch((err) => {
      console.error(`[webhooks] dispatch failed for invoice ${id}:`, err);
    });
  }
  return row;
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
