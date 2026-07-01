---
type: business_context
version: 1.0
last_updated: 2026-06-30
tags: [vision, scope, hackathon, lsp]
---

# Project Vision — FiberGate

## Vấn đề đang giải quyết

Hiện tại, để nhận thanh toán qua Fiber Network, developer phải:
1. Tự cài đặt và chạy một Fiber Node (FNN binary)
2. Tự mở channel với các public nodes (lock CKB on-chain)
3. Tự quản lý liquidity
4. Tự gọi JSON-RPC để tạo invoice và poll trạng thái

→ Barrier to entry quá cao. Không có developer nào tích hợp payment nhanh được.

## Giải pháp

FiberGate là một **self-hosted, open-source Fiber payment gateway framework**:
- Merchant tự deploy `docker compose up -d` (Fiber node + PostgreSQL + FiberGate core), tự vận hành node và dữ liệu của mình
- Gọi `POST /api/v1/invoices` (nội bộ, cùng docker network hoặc qua secret riêng) → nhận invoice ngay lập tức
- Nhận webhook notification khi payment thành công
- Không cần tự viết code kết nối Fiber RPC, quản lý invoice state machine, hay tự build webhook delivery — FiberGate đóng gói sẵn phần hạ tầng đó

**Tại sao chọn framing self-hosted thay vì managed SaaS:** Hackathon "Gone in 60ms" quy định "infrastructure only, not products built on top" (dự án sản phẩm/thương mại có hackathon riêng sau này). Một platform SaaS custodial đa khách hàng dễ bị xếp vào nhóm "product built on top". Đóng gói thành framework mã nguồn mở mà bất kỳ ai cũng tự deploy được thì khớp đúng category **"Merchant, Liquidity, LSP, and Multi-Asset Infrastructure"**.

## Hackathon Scope (prototype)

**IN SCOPE — Phase 1 (core, ưu tiên cao nhất):**
- Docker-compose bundle: Fiber node (FNN binary) + PostgreSQL + FiberGate core (Next.js: dashboard + API)
- Dashboard cá nhân (single-admin, không multi-tenant): xem invoices/transactions, cấu hình webhooks, xem trạng thái node
- REST API: tạo invoice, query status, list invoices
- Webhook system: fire events khi invoice paid/expired (HMAC-signed)
- npm SDK: `@fibergate/sdk` với TypeScript support
- Một Fiber node trên testnet
- **Demo merchant checkout flow**: 1 trang storefront giả lập (VD: bán 1 khóa học/API key) dùng SDK/API để tạo invoice, hiện QR, và nhận webhook khi thanh toán xong
- **1 instance demo được deploy public** (VPS/cloud của team) cho giám khảo bấm thử trực tiếp — bắt buộc theo deliverables hackathon ("demo link... plus a hosted demo"), ngoài docker-compose instructions cho người muốn tự deploy

**IN SCOPE — Phase 2 (sau khi Phase 1 ổn định):**
- Thay in-process polling bằng Fiber node event subscription real-time (JSON-RPC/WebSocket)

**IN SCOPE — Phase 3 (optional stretch, nếu còn thời gian):**
- L402 subscription middleware (pay-as-you-go API / gated content)

**OUT OF SCOPE (documented as future work):**
- Managed/hosted offering bởi FiberGate team (đã pivot khỏi hướng này)
- Multi-tenant accounts / multiple merchants trên cùng 1 deployment
- Mainnet deployment
- Multi-node / high availability
- On/off ramp
- Automatic channel rebalancing (chỉ manual)

## Trade-offs đã chấp nhận (phải document rõ trong submission)

**Node vẫn giữ funds trong channel:** Đây là đặc điểm vốn có của bất kỳ LSP/node operator nào (không phải rủi ro riêng của FiberGate) — nhưng vì self-hosted, node key và funds thuộc về chính merchant vận hành, không phải bên thứ ba (FiberGate team) giữ hộ như mô hình custodial SaaS trước đây.

**Single node:** Một node duy nhất trên testnet. Single point of failure.

**Settlement delay:** Tiền trong channel chưa phải tiền on-chain. Merchant thấy "paid" nhưng thực ra là credit trong channel.

## Target users

- Merchant/developer muốn tự host một cổng thanh toán Fiber cho app của mình (Next.js, React, Node.js)
- Hackathon participants muốn demo Fiber payment mà không tự viết code RPC/webhook từ đầu
- Người vận hành muốn nhận CKB/RUSD testnet payments trên hạ tầng do chính họ kiểm soát

## So sánh với fiber-checkout

| | fiber-checkout | FiberGate |
|---|---|---|
| Developer cần chạy node? | Có | Có (đóng gói sẵn trong docker-compose) |
| Developer cần quản lý liquidity? | Có | Có, nhưng có dashboard hỗ trợ theo dõi |
| Có dashboard + webhook + invoice API đóng gói sẵn? | Không | Có |
| Custodial? | Không (self-custody) | Không (self-hosted, self-custody) |