---
type: data_dictionary
version: 1.0
last_updated: 2026-06-30
tags: [supabase, postgresql, schema]
---

# Database Schema — Supabase

> Auth: dùng Supabase Auth built-in (bảng `auth.users` tự động)

## Bảng: `profiles`

Extend từ `auth.users`. Tạo tự động qua trigger khi user sign up.

| Column | Type | Constraints | Mô tả |
|--------|------|-------------|-------|
| id | uuid | PK, FK → auth.users.id | |
| email | text | NOT NULL | |
| full_name | text | | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

## Bảng: `api_keys`

| Column | Type | Constraints | Mô tả |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| user_id | uuid | FK → profiles.id, NOT NULL | |
| name | text | NOT NULL | Tên key do user đặt, VD: "Production" |
| client_id | text | UNIQUE, NOT NULL | Public ID, prefix `pk_test_` |
| secret_hash | text | NOT NULL | BCRYPT hash của api_secret, không lưu plaintext |
| last_used_at | timestamptz | | Cập nhật mỗi lần dùng |
| is_active | boolean | DEFAULT true | |
| created_at | timestamptz | DEFAULT now() | |

> Lưu ý: `api_secret` (prefix `sk_test_`) chỉ trả về một lần khi tạo, không bao giờ lưu plaintext.

## Bảng: `invoices`

| Column | Type | Constraints | Mô tả |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | Internal ID |
| user_id | uuid | FK → profiles.id, NOT NULL | |
| api_key_id | uuid | FK → api_keys.id | Key nào tạo invoice này |
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
| user_id | uuid | FK → profiles.id, NOT NULL | |
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

## Row Level Security (RLS)

Tất cả bảng đều bật RLS. Pattern chuẩn:
```sql
-- Chỉ xem data của chính mình
CREATE POLICY "Users can view own data" ON invoices
  FOR SELECT USING (auth.uid() = user_id);

-- Chỉ insert với user_id = auth.uid()
CREATE POLICY "Users can insert own data" ON invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```