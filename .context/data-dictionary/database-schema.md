---
type: data_dictionary
version: 1.3
last_updated: 2026-07-11
tags: [postgresql, drizzle, schema, self-hosted]
---

# Database Schema — PostgreSQL (self-hosted, Drizzle ORM)

> Single-tenant: mỗi deployment chỉ phục vụ 1 merchant. Không có bảng users/accounts,
> không có Auth multi-user — dashboard vẫn là single-admin password gate, nhưng từ
> issue #30, bcrypt hash của password này **có thể lưu trong bảng `settings` bên dưới**
> (DB-backed, thay đổi được qua Dashboard → Settings) thay vì chỉ đọc từ
> `ADMIN_PASSWORD_HASH_B64` (env var) như trước — env var giờ chỉ seed giá trị ban đầu,
> xem bảng `settings` và `architecture/system-design.md`'s "Dashboard auth".

## Bảng: `invoices`

| Column | Type | Constraints | Mô tả |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | Internal ID |
| payment_hash | text | UNIQUE, NOT NULL | Từ Fiber node, dùng để poll |
| invoice_address | text | NOT NULL | Bech32m string, gửi cho payer |
| amount_shannon | bigint | NOT NULL | Lưu dạng shannon (integer) |
| asset | text | NOT NULL | "CKB" hoặc "RUSD" |
| description | text | | |
| status | invoice_status (Postgres native ENUM: pending, paid, expired, failed) | NOT NULL DEFAULT 'pending' | pending / paid / expired / failed |
| expires_at | timestamptz | NOT NULL | |
| paid_at | timestamptz | | Khi status → paid |
| metadata | jsonb | | Dữ liệu tùy chỉnh từ developer |
| created_at | timestamptz | DEFAULT now() | |

> **Cập nhật 2026-07-03 (issue #4)**: `status` dùng Drizzle `pgEnum` → Postgres
> native `CREATE TYPE invoice_status AS ENUM ('pending','paid','expired','failed')`,
> thay vì `text` như bản trước — giá trị là 1 tập cố định, đóng, nên enum ở DB
> level phù hợp hơn. Xem `apps/web/lib/db/schema.ts` (`invoiceStatusEnum`).
> Lưu ý: `webhook_deliveries.status` KHÔNG đổi theo — vẫn là `text` (domain
> giá trị khác: pending/success/failed), xem bảng `webhook_deliveries` bên dưới.
>
> Status transitions: pending → paid (terminal), pending → expired (terminal), pending → failed (terminal).
> BR-STS-001: một chiều duy nhất, không có transition ngược — không có DB-level
> trigger/constraint enforce việc này, chỉ document qua comment trong `schema.ts`.

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

## Bảng: `settings`

Generic key-value config, thêm ở issue #30. Consumer đầu tiên (và duy nhất tính tới
lúc này): key `admin_password_hash` — thay thế phần env-only cũ của `ADMIN_PASSWORD_HASH_B64`.

| Column | Type | Constraints | Mô tả |
|--------|------|-------------|-------|
| key | text | PK | vd `"admin_password_hash"` |
| value | text | NOT NULL | Với `admin_password_hash`: raw bcrypt hash (không base64 — base64-encoding chỉ cần cho `.env`/Docker Compose interpolation, không áp dụng khi lưu thẳng trong DB) |
| updated_at | timestamptz | DEFAULT now() | |

> **Read-order cho `admin_password_hash`** (`lib/services/settings.ts`): nếu có row →
> dùng giá trị đó; nếu chưa có row nào (chưa từng đổi password qua Dashboard) → fallback
> đọc `ADMIN_PASSWORD_HASH_B64` (env var, giải mã base64 giống hệt logic cũ). Nói cách
> khác: env var chỉ seed giá trị ban đầu, ngay khi admin đổi password lần đầu qua
> Dashboard → Settings, 1 row được ghi vào đây và **từ đó về sau DB luôn thắng** — env
> var không còn được đọc tới nữa cho tới khi row đó bị xoá thủ công.

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

## Quy tắc quản lý migration

Thư mục `apps/web/lib/db/migrations/` là **append-only** — mỗi file (`0000_xxx.sql`,
`0001_xxx.sql`, ...) là 1 bước thay đổi lịch sử, giống commit git. Drizzle lưu trong
chính DB (bảng nội bộ) migration nào đã chạy — xóa/sửa 1 file cũ mà DB nào đó đã chạy
rồi sẽ làm Drizzle mất dấu, gây lỗi khó debug.

- **Sau khi sửa `schema.ts`**: chạy `pnpm --filter web db:generate` để sinh migration
  **mới** (`0001_...`), không sửa lại file `0000_naive_maverick.sql` hay các file cũ hơn.
- **Squash/gộp migration cũ**: chỉ hợp lý khi migration đó **chưa từng chạy** ở bất kỳ
  deployment thật nào (dev/staging/prod/demo public). Ngay khi 1 migration đã merge vào
  `canary`/`main` và có nơi nào chạy `db:migrate` với nó, coi như "đóng băng" — chỉ được
  thêm mới, không xóa/sửa.
- Việc chạy `drizzle-kit generate` **không** đụng vào DB thật, chỉ sinh file SQL. Phải
  chạy `drizzle-kit migrate` (qua `pnpm --filter web db:migrate`) thì bảng mới thực sự
  được tạo/cập nhật trong Postgres — xem `docs/maintainers/getting-started.md`.

## Row Level Security

Không cần RLS: mỗi deployment chỉ phục vụ 1 merchant, PostgreSQL chỉ truy cập nội bộ
qua docker network (không expose port ra ngoài internet), không có khái niệm "data của user khác".