-- FiberGate schema — mirrors .context/data-dictionary/database-schema.md and
-- apps/web/lib/db/schema.ts. Applied automatically by postgres on first init.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_hash     text NOT NULL UNIQUE,
  invoice_address  text NOT NULL,
  amount_shannon   bigint NOT NULL,
  asset            text NOT NULL,
  description      text,
  status           text NOT NULL DEFAULT 'pending',
  expires_at       timestamptz NOT NULL,
  paid_at          timestamptz,
  metadata         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_status_idx     ON invoices (status);
CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON invoices (created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url         text NOT NULL,
  secret      text NOT NULL,
  events      text[] NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id    uuid NOT NULL REFERENCES webhook_endpoints (id) ON DELETE CASCADE,
  invoice_id     uuid NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  event_type     text NOT NULL,
  payload        jsonb NOT NULL,
  http_status    integer,
  response_body  text,
  attempt_count  integer NOT NULL DEFAULT 1,
  status         text NOT NULL,
  next_retry_at  timestamptz,
  delivered_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wh_deliveries_endpoint_idx ON webhook_deliveries (endpoint_id);
CREATE INDEX IF NOT EXISTS wh_deliveries_retry_idx    ON webhook_deliveries (status, next_retry_at);

CREATE TABLE IF NOT EXISTS node_snapshots (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_pubkey                 text NOT NULL,
  total_channels              integer,
  active_channels             integer,
  inbound_capacity_shannon    bigint,
  outbound_capacity_shannon   bigint,
  peer_count                  integer,
  snapshot_at                 timestamptz NOT NULL DEFAULT now()
);
