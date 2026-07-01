---
type: data_dictionary
version: 1.0
last_updated: 2026-06-30
tags: [postgresql, drizzle, schema, self-hosted]
---

# Database Schema — PostgreSQL (self-hosted, Drizzle ORM)

> Single-tenant: mỗi deployment chỉ phục vụ 1 merchant. Không có bảng users/accounts,
> không có Auth — dashboard bảo vệ bằng single-admin password gate (xem `ADMIN_PASSWORD_HASH`
> trong `architecture/system-design.md`), không lưu trong DB.

## Bảng: `invoices`

| Column | Type | Constraints | Mô tả |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | Internal ID |
| payment_hash | text | UNIQUE, NOT NULL | Từ Fiber node, dùng để poll |
| invoice_address | text | NOT NULL | Bech32m string, gửi cho payer |
| amount_shannon | bigint | NOT NULL | Lưu dạng shannon (integer) |
| asset | text | NOT NULL | "CKB" hoặc "RUSD" |
| description | text | | |
| status | text | NOT NULL DEFAULT 'pending' | pending / paid / expired / failed |
| expires_at | timestamptz | NOT NULL | |
| paid_at | timestamptz | | Khi status → paid |
| metadata | jsonb | | Dữ liệu tùy chỉnh từ developer |
| created_at | timestamptz | DEFAULT now() | |

> Status transitions: pending → paid (terminal), pending → expired (terminal), pending → failed (terminal)

## Bảng: `webhook_endpoints`

| Column | Type | Constraints | Mô tả |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| url | text | NOT NULL | Merchant's HTTPS endpoint |
| secret | text | NOT NULL | Random string dùng để HMAC sign, lưu encrypted |
| events | text[] | NOT NULL | Mảng events: ["payment.paid", "invoice.expired"] |
| is_active | boolean | DEFAULT true | |
| created_at | timestamptz | DEFAULT now() | |

> Events hỗ trợ: `payment.paid`, `invoice.expired`, `invoice.failed`

## Bảng: `webhook_deliveries`

| Column | Type | Constraints | Mô tả |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| endpoint_id | uuid | FK → webhook_endpoints.id | |
| invoice_id | uuid | FK → invoices.id | |
| event_type | text | NOT NULL | |
| payload | jsonb | NOT NULL | Payload đã gửi |
| http_status | integer | | Response status code |
| response_body | text | | Response body (truncated 1KB) |
| attempt_count | integer | DEFAULT 1 | |
| status | text | NOT NULL | pending / success / failed |
| next_retry_at | timestamptz | | Null nếu không retry |
| delivered_at | timestamptz | | Khi thành công |
| created_at | timestamptz | DEFAULT now() | |

## Bảng: `node_snapshots`

Lưu trạng thái node định kỳ (mỗi 1 phút). Dùng để hiển thị dashboard metrics.

| Column | Type | Constraints | Mô tả |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| node_pubkey | text | NOT NULL | |
| total_channels | integer | | |
| active_channels | integer | | |
| inbound_capacity_shannon | bigint | | |
| outbound_capacity_shannon | bigint | | |
| peer_count | integer | | |
| snapshot_at | timestamptz | DEFAULT now() | |

## Row Level Security

Không cần RLS: mỗi deployment chỉ phục vụ 1 merchant, PostgreSQL chỉ truy cập nội bộ
qua docker network (không expose port ra ngoài internet), không có khái niệm "data của user khác".