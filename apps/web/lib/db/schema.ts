import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Real Postgres native enum (Drizzle `pgEnum`) for `invoices.status` — a
 * fixed, closed set of values, chosen over plain `text` per the resolved
 * schema decision for issue #4 (see harness-brief.md "Resolved decisions" #3).
 * `.context/data-dictionary/database-schema.md` has been updated in this same
 * iteration to reflect this pgEnum type.
 *
 * BR-STS-001: transitions are one-directional only —
 *   pending -> paid | expired | failed
 * There is no reverse transition, and no DB-level trigger/CHECK enforces
 * this — application code (poller, API routes) is responsible for only ever
 * moving a row forward along this graph.
 *
 * BR-STS-002 (informational): status -> 'expired' is set by the poller when
 * `expires_at` has passed for a still-pending invoice.
 * BR-STS-003 (informational): status -> 'failed' is set by the poller when
 * the Fiber node reports the payment attempt failed.
 * Neither transition is implemented here — this issue is schema-only; the
 * poller/state-machine logic belongs to a separate issue.
 */
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "paid",
  "expired",
  "failed",
]);

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentHash: text("payment_hash").notNull().unique(),
  invoiceAddress: text("invoice_address").notNull(),
  // shannon units (1 CKB = 10^8 shannon) — bigint mode to avoid precision
  // loss past Number.MAX_SAFE_INTEGER for large invoices.
  amountShannon: bigint("amount_shannon", { mode: "bigint" }).notNull(),
  asset: text("asset").notNull(),
  description: text("description"),
  // BR-STS-001/002/003: see invoiceStatusEnum doc comment above.
  status: invoiceStatusEnum("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type InvoiceRow = typeof invoices.$inferSelect;

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").array().notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type WebhookEndpointRow = typeof webhookEndpoints.$inferSelect;

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  // FK default (no onDelete specified) is Postgres/Drizzle's own default,
  // NO ACTION — deliberately not CASCADE, since deleting an endpoint/invoice
  // must never silently wipe delivery history (BR-WHK-005: "Lưu toàn bộ
  // delivery history... dù thành công hay fail").
  endpointId: uuid("endpoint_id").references(() => webhookEndpoints.id),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  httpStatus: integer("http_status"),
  responseBody: text("response_body"),
  attemptCount: integer("attempt_count").default(1),
  // Plain text (not pgEnum) — this is webhook_deliveries.status
  // (pending/success/failed), a different domain than invoices.status. Only
  // invoices.status was changed to pgEnum per the resolved decision for
  // issue #4; this column is unaffected.
  status: text("status").notNull(),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect;

// Generic key-value app config (issue #30). First consumer: "admin_password_hash"
// (lib/services/settings.ts) — replaces ADMIN_PASSWORD_HASH_B64-only auth with a
// DB-backed value the admin can change from the Dashboard. The env var still seeds
// the initial value; once a row exists here for a given key, the DB value wins.
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type SettingRow = typeof settings.$inferSelect;

export const nodeSnapshots = pgTable("node_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  nodePubkey: text("node_pubkey").notNull(),
  totalChannels: integer("total_channels"),
  activeChannels: integer("active_channels"),
  inboundCapacityShannon: bigint("inbound_capacity_shannon", { mode: "bigint" }),
  outboundCapacityShannon: bigint("outbound_capacity_shannon", { mode: "bigint" }),
  peerCount: integer("peer_count"),
  snapshotAt: timestamp("snapshot_at", { withTimezone: true }).defaultNow(),
});
