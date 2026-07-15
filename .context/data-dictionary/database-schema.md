---
type: data_dictionary
version: 1.3
last_updated: 2026-07-11
tags: [postgresql, drizzle, schema, self-hosted]
---

# Database Schema — PostgreSQL (self-hosted, Drizzle ORM)

> Single-tenant: each deployment serves exactly 1 merchant. There's no users/accounts
> table, no multi-user auth — the dashboard is still a single-admin password gate, but
> as of issue #30, this password's bcrypt hash **can be stored in the `settings` table
> below** (DB-backed, changeable via Dashboard → Settings) instead of only being read
> from `ADMIN_PASSWORD_HASH_B64` (env var) as before — the env var now only seeds the
> initial value, see the `settings` table and `architecture/system-design.md`'s
> "Dashboard auth".

## Table: `invoices`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | Internal ID |
| payment_hash | text | UNIQUE, NOT NULL | From the Fiber node, used to poll |
| invoice_address | text | NOT NULL | Bech32m string, sent to the payer |
| amount_shannon | bigint | NOT NULL | Stored as shannon (integer) |
| asset | text | NOT NULL | "CKB" or "RUSD" |
| description | text | | |
| status | invoice_status (Postgres native ENUM: pending, paid, expired, failed) | NOT NULL DEFAULT 'pending' | pending / paid / expired / failed |
| expires_at | timestamptz | NOT NULL | |
| paid_at | timestamptz | | Set when status → paid |
| metadata | jsonb | | Custom developer-supplied data |
| created_at | timestamptz | DEFAULT now() | |

> **Updated 2026-07-03 (issue #4)**: `status` uses Drizzle `pgEnum` → a Postgres
> native `CREATE TYPE invoice_status AS ENUM ('pending','paid','expired','failed')`,
> instead of `text` as before — the value set is fixed and closed, so a DB-level
> enum fits better. See `apps/web/lib/db/schema.ts` (`invoiceStatusEnum`).
> Note: `webhook_deliveries.status` did NOT change along with this — it's still
> `text` (a different value domain: pending/success/failed), see the
> `webhook_deliveries` table below.
>
> Status transitions: pending → paid (terminal), pending → expired (terminal), pending → failed (terminal).
> BR-STS-001: one direction only, no reverse transitions — there's no DB-level
> trigger/constraint enforcing this, it's only documented via a comment in `schema.ts`.

## Table: `webhook_endpoints`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| url | text | NOT NULL | Merchant's HTTPS endpoint |
| secret | text | NOT NULL | Random string used for HMAC signing, stored encrypted |
| events | text[] | NOT NULL | Array of events: ["payment.paid", "invoice.expired"] |
| is_active | boolean | DEFAULT true | |
| created_at | timestamptz | DEFAULT now() | |

> Supported events: `payment.paid`, `invoice.expired`, `invoice.failed`

## Table: `webhook_deliveries`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| endpoint_id | uuid | FK → webhook_endpoints.id | |
| invoice_id | uuid | FK → invoices.id | |
| event_type | text | NOT NULL | |
| payload | jsonb | NOT NULL | The payload that was sent |
| http_status | integer | | Response status code |
| response_body | text | | Response body (truncated to 1KB) |
| attempt_count | integer | DEFAULT 1 | |
| status | text | NOT NULL | pending / success / failed |
| next_retry_at | timestamptz | | Null if no retry |
| delivered_at | timestamptz | | Set on success |
| created_at | timestamptz | DEFAULT now() | |

## Table: `settings`

Generic key-value config, added in issue #30. First (and, so far, only) consumer:
the `admin_password_hash` key — replacing the old env-only `ADMIN_PASSWORD_HASH_B64`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------|
| key | text | PK | e.g. `"admin_password_hash"` |
| value | text | NOT NULL | For `admin_password_hash`: the raw bcrypt hash (not base64 — base64-encoding is only needed for `.env`/Docker Compose interpolation, not when storing directly in the DB) |
| updated_at | timestamptz | DEFAULT now() | |

> **Read order for `admin_password_hash`** (`lib/services/settings.ts`): if a row
> exists → use that value; if no row exists yet (password never changed via the
> Dashboard) → fall back to reading `ADMIN_PASSWORD_HASH_B64` (env var, base64-decoded
> the same way as the old logic). In other words: the env var only seeds the initial
> value — as soon as the admin changes the password for the first time via
> Dashboard → Settings, a row is written here and **from then on the DB always wins**
> — the env var is no longer read until that row is manually deleted.

## Table: `node_snapshots`

Stores periodic node status (every 1 minute). Used to render dashboard metrics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| node_pubkey | text | NOT NULL | |
| total_channels | integer | | |
| active_channels | integer | | |
| inbound_capacity_shannon | bigint | | |
| outbound_capacity_shannon | bigint | | |
| peer_count | integer | | |
| snapshot_at | timestamptz | DEFAULT now() | |

## Migration management rules

The `apps/web/lib/db/migrations/` directory is **append-only** — each file (`0000_xxx.sql`,
`0001_xxx.sql`, ...) is one step in a historical sequence, like a git commit. Drizzle
tracks which migrations have run in the DB itself (an internal table) — deleting/editing
an old file that some DB has already run will make Drizzle lose track, causing hard-to-debug errors.

- **After editing `schema.ts`**: run `pnpm --filter web db:generate` to generate a
  **new** migration (`0001_...`); don't edit `0000_naive_maverick.sql` or any older file.
- **Squashing/merging old migrations**: only reasonable when that migration has
  **never run** against any real deployment (dev/staging/prod/public demo). As soon
  as a migration has merged into `canary`/`main` and anywhere has run `db:migrate`
  with it, treat it as "frozen" — only additions are allowed, no deletions/edits.
- Running `drizzle-kit generate` **does not** touch the real DB, it only generates a
  SQL file. You must run `drizzle-kit migrate` (via `pnpm --filter web db:migrate`)
  for tables to actually be created/updated in Postgres — see
  `docs/maintainers/getting-started.md`.

## Row Level Security

RLS isn't needed: each deployment serves only 1 merchant, PostgreSQL is only accessed
internally over the docker network (no port exposed to the internet), and there's no
concept of "another user's data."