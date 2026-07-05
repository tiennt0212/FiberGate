---
type: user_stories
persona: developer
version: 1.0
last_updated: 2026-07-02
tags: [integration, onboarding, webhook, sdk]
---

# User Stories — Developer Integration

## US-001: Deploy FiberGate bằng Docker Compose

**As a** merchant muốn nhận Fiber payments,
**I want to** tự deploy FiberGate trên hạ tầng của mình,
**So that** tôi tự vận hành node và dữ liệu, không phụ thuộc bên thứ ba.

**Acceptance criteria:**
- Clone repo, copy `.env.example` → `.env`, set các biến bắt buộc: `POSTGRES_PASSWORD`, `ADMIN_PASSWORD_HASH_B64`, `DASHBOARD_SESSION_SECRET`, `FIBERGATE_INTERNAL_SECRET` (`FIBER_NODE_URL` đã có sẵn giá trị mặc định cho docker network, không cần đổi; `DATABASE_URL` không tự set — derive từ `POSTGRES_*`)
- Cung cấp CKB testnet key cho fiber-node (`docker/fiber-node/ckb/key` + `FIBER_SECRET_KEY_PASSWORD`) — xem README "Running the full stack"
- Chạy `docker compose up -d` → khởi động 3 container: fiber-node, postgres, fibergate-core
- Truy cập dashboard, đăng nhập bằng plaintext password đã dùng để tạo `ADMIN_PASSWORD_HASH_B64` (single-admin, không có sign up)
- Có thể revoke/rotate `FIBERGATE_INTERNAL_SECRET` bằng cách đổi env var và restart container

## US-002: Tích hợp SDK vào Next.js app

**As a** developer dùng Next.js,
**I want to** tích hợp Fiber payment trong 10 phút,
**So that** users của tôi có thể thanh toán bằng CKB.

**Acceptance criteria:**
```bash
npm install @fibergate/sdk
```
```typescript
// Tạo invoice (server-side) — trỏ về FiberGate core tự deploy của bạn
const gateway = new FiberGate({
  baseUrl: process.env.FIBERGATE_BASE_URL,       // http://<merchant-host>:<port>
  internalSecret: process.env.FIBERGATE_INTERNAL_SECRET,
})
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