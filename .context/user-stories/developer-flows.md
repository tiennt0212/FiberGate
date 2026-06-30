---
type: user_stories
persona: developer
version: 1.0
last_updated: 2026-06-30
tags: [integration, onboarding, webhook, sdk]
---

# User Stories — Developer Integration

## US-001: Đăng ký và lấy API key

**As a** developer muốn nhận Fiber payments,
**I want to** đăng ký tài khoản và lấy API key,
**So that** tôi có thể gọi Fiber Gateway API.

**Acceptance criteria:**
- Đăng ký bằng email/password qua Supabase Auth
- Sau khi login, vào trang /keys
- Tạo key mới với tên tùy chọn
- Nhận `client_id` (pk_test_xxx) và `api_secret` (sk_test_xxx)
- `api_secret` chỉ hiển thị một lần, có nút copy, có warning rõ ràng
- Có thể revoke key bất cứ lúc nào

## US-002: Tích hợp SDK vào Next.js app

**As a** developer dùng Next.js,
**I want to** tích hợp Fiber payment trong 10 phút,
**So that** users của tôi có thể thanh toán bằng CKB.

**Acceptance criteria:**
```bash
npm install @fiber-gateway/sdk
```
```typescript
// Tạo invoice (server-side)
const gateway = new FiberGateway({ apiSecret: process.env.FIBER_API_SECRET })
const invoice = await gateway.invoices.create({ amount: 1, asset: 'CKB' })

// Verify webhook (trong route handler)
const isValid = gateway.webhooks.verify(body, signature, secret)
```

## US-003: Nhận webhook khi có thanh toán

**As a** developer,
**I want to** nhận HTTP notification khi user thanh toán xong,
**So that** tôi có thể fulfill order ngay lập tức.

**Acceptance criteria:**
- Vào dashboard → Webhooks → Add endpoint
- Nhập URL và chọn events (payment.paid, invoice.expired)
- Nhận webhook secret để verify signature
- Có thể xem lịch sử webhook deliveries (status, response, timestamp)
- Có nút "Resend" cho failed deliveries

## US-004: Monitor trạng thái node và channels

**As a** developer,
**I want to** xem trạng thái node và liquidity capacity,
**So that** tôi biết gateway có đủ khả năng nhận payment không.

**Acceptance criteria:**
- Dashboard hiển thị: node online/offline, số channels active, inbound/outbound capacity
- Nếu inbound capacity < 10 CKB → hiển thị warning "Low capacity"
- GET /api/v1/node/info trả về thông tin này