---
type: business_rules
module: payment-processing
version: 1.0
last_updated: 2026-06-30
tags: [invoice, webhook, polling, limits]
---

# Business Rules — Payment Processing

## Invoice Rules

**BR-INV-001:** Amount tối thiểu: 0.1 CKB (= 10,000,000 shannon). Amount tối đa: 1,000 CKB cho prototype.

**BR-INV-002:** Asset chỉ chấp nhận "CKB" hoặc "RUSD" trong prototype.

**BR-INV-003:** Thời gian expire mặc định: 3600 giây (1 giờ). Tối đa 86400 giây (24 giờ).

**BR-INV-004:** Chuyển đổi amount: `shannon = Math.round(amount_ckb * 100_000_000)`. Lưu dạng bigint trong DB.

**BR-INV-005:** invoice_address và payment_hash lấy từ Fiber node RPC `new_invoice`. Không tự generate.

## Status Transition Rules

**BR-STS-001:** Status chỉ đi theo một chiều: `pending → paid | expired | failed`. Không thể reverse.

**BR-STS-002:** Status "expired" được set khi: (a) Fiber node báo expired, hoặc (b) `expires_at < now()` dù chưa poll.

**BR-STS-003:** Status "failed" được set khi: Fiber node báo invoice bị cancelled.

## Polling Rules

**BR-POL-001:** Poller chạy mỗi 10 giây qua Vercel Cron (`/api/cron/poll-invoices`).

**BR-POL-002:** Chỉ poll invoices có `status = "pending"` và `expires_at > now() - 60s`.

**BR-POL-003:** Mỗi batch poll tối đa 50 invoices để tránh timeout Vercel (max 10s execution).

**BR-POL-004:** Nếu Fiber node không phản hồi sau 5s, skip và log error, không change status.

## Webhook Rules

**BR-WHK-001:** Fire webhook ngay khi invoice status thay đổi sang terminal state (paid/expired/failed).

**BR-WHK-002:** Webhook request timeout: 5 giây.

**BR-WHK-003:** Retry strategy: immediate → 1 phút → 5 phút. Tổng tối đa 3 attempts.

**BR-WHK-004:** Webhook payload phải được sign bằng HMAC-SHA256 với key là webhook endpoint's secret.

**BR-WHK-005:** Lưu toàn bộ delivery history trong `webhook_deliveries` dù thành công hay fail.

## Rate Limiting Rules

**BR-RTE-001:** Mỗi API key được tạo tối đa 100 invoices/phút (prototype).

**BR-RTE-002:** GET /invoices list tối đa 100 items/request.

## Security Rules

**BR-SEC-001:** `api_secret` không bao giờ được lưu plaintext. Chỉ lưu bcrypt hash.

**BR-SEC-002:** `api_secret` chỉ được trả về một lần duy nhất khi tạo key, không thể retrieve lại.

**BR-SEC-003:** Webhook secret phải random, tối thiểu 32 bytes.

**BR-SEC-004:** Tất cả Supabase queries từ API routes phải dùng `service_role` key + RLS bypass, nhưng phải validate user_id thủ công.