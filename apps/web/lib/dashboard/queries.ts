import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { invoices, webhookDeliveries, webhookEndpoints } from "@/lib/db/schema";
import type {
  Invoice as InvoiceRow,
  WebhookDelivery,
  WebhookEndpoint,
} from "@/lib/db/schema";
import { shannonToAmount } from "@/lib/invoices/constants";

export interface DashboardStats {
  volumeCkb: number;
  volumeRusd: number;
  paidCount: number;
  pendingCount: number;
  totalCount: number;
  successRate: number; // 0..1 over terminal invoices
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const byStatus = await db
    .select({ status: invoices.status, count: sql<number>`count(*)::int` })
    .from(invoices)
    .groupBy(invoices.status);

  const counts = Object.fromEntries(byStatus.map((r) => [r.status, r.count])) as Record<string, number>;

  const paidVolume = await db
    .select({
      asset: invoices.asset,
      total: sql<string>`coalesce(sum(${invoices.amountShannon}), 0)`,
    })
    .from(invoices)
    .where(eq(invoices.status, "paid"))
    .groupBy(invoices.asset);

  const volume = Object.fromEntries(paidVolume.map((r) => [r.asset, BigInt(r.total)]));

  const paid = counts.paid ?? 0;
  const expired = counts.expired ?? 0;
  const failed = counts.failed ?? 0;
  const terminal = paid + expired + failed;

  return {
    volumeCkb: shannonToAmount(volume.CKB ?? 0n),
    volumeRusd: shannonToAmount(volume.RUSD ?? 0n),
    paidCount: paid,
    pendingCount: counts.pending ?? 0,
    totalCount: Object.values(counts).reduce((a, b) => a + b, 0),
    successRate: terminal === 0 ? 0 : paid / terminal,
  };
}

export function getRecentInvoices(limit = 5): Promise<InvoiceRow[]> {
  return db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(limit);
}

export function getAllInvoices(limit = 200): Promise<InvoiceRow[]> {
  return db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(limit);
}

export interface EndpointWithStats extends WebhookEndpoint {
  totalDeliveries: number;
  successDeliveries: number;
  lastDeliveryAt: Date | null;
}

export async function getEndpointsWithStats(): Promise<EndpointWithStats[]> {
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .orderBy(desc(webhookEndpoints.createdAt));

  const stats = await db
    .select({
      endpointId: webhookDeliveries.endpointId,
      total: sql<number>`count(*)::int`,
      success: sql<number>`count(*) filter (where ${webhookDeliveries.status} = 'success')::int`,
      last: sql<Date | null>`max(${webhookDeliveries.createdAt})`,
    })
    .from(webhookDeliveries)
    .groupBy(webhookDeliveries.endpointId);

  const byEndpoint = new Map(stats.map((s) => [s.endpointId, s]));
  return endpoints.map((e) => {
    const s = byEndpoint.get(e.id);
    return {
      ...e,
      totalDeliveries: s?.total ?? 0,
      successDeliveries: s?.success ?? 0,
      lastDeliveryAt: s?.last ?? null,
    };
  });
}

export function getDeliveries(limit = 100): Promise<WebhookDelivery[]> {
  return db
    .select()
    .from(webhookDeliveries)
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
}

export interface SettlementRow {
  invoiceId: string;
  event: string;
  endpointUrl: string;
  httpStatus: number | null;
  deliveryStatus: string;
  deliveredAt: Date | null;
  createdAt: Date;
}

/** Paid-invoice webhook deliveries — the settlement record (project-vision "Settlement view"). */
export async function getSettlementRows(limit = 100): Promise<SettlementRow[]> {
  const rows = await db
    .select({
      invoiceId: webhookDeliveries.invoiceId,
      event: webhookDeliveries.eventType,
      endpointUrl: webhookEndpoints.url,
      httpStatus: webhookDeliveries.httpStatus,
      deliveryStatus: webhookDeliveries.status,
      deliveredAt: webhookDeliveries.deliveredAt,
      createdAt: webhookDeliveries.createdAt,
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookDeliveries.endpointId, webhookEndpoints.id))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
  return rows;
}
