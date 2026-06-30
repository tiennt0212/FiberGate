---
type: business_context
version: 1.0
last_updated: 2026-06-30
tags: [vision, scope, hackathon, lsp]
---

# Project Vision — Fiber Gateway

## Vấn đề đang giải quyết

Hiện tại, để nhận thanh toán qua Fiber Network, developer phải:
1. Tự cài đặt và chạy một Fiber Node (FNN binary)
2. Tự mở channel với các public nodes (lock CKB on-chain)
3. Tự quản lý liquidity
4. Tự gọi JSON-RPC để tạo invoice và poll trạng thái

→ Barrier to entry quá cao. Không có developer nào tích hợp payment nhanh được.

## Giải pháp

Fiber Gateway là một managed LSP (Lightning Service Provider):
- Developer đăng ký → nhận `client_id` + `api_secret`
- Gọi `POST /api/v1/invoices` → nhận invoice ngay lập tức
- Nhận webhook notification khi payment thành công
- Không cần biết gì về Fiber node, channel, liquidity

## Hackathon Scope (prototype)

**IN SCOPE:**
- Developer dashboard (đăng ký, quản lý API keys, xem transactions, cấu hình webhooks)
- REST API: tạo invoice, query status, list invoices
- Webhook system: fire events khi invoice paid/expired
- npm SDK: `@fiber-gateway/sdk` với TypeScript support
- Một Fiber node trên testnet (custodial prototype)
- Kết nối đến public testnet nodes

**OUT OF SCOPE (documented as future work):**
- Non-custodial / merchant tự giữ key
- Mainnet deployment
- Multi-node / high availability
- On/off ramp
- Automatic channel rebalancing (chỉ manual)

## Trade-offs đã chấp nhận (phải document rõ trong submission)

**Custodial risk:** Platform giữ private key của Fiber node → giữ tiền trong channels. Đây là limitation của prototype. Production cần giải quyết bằng mô hình non-custodial hoặc HSM.

**Single node:** Một node duy nhất trên testnet. Single point of failure.

**Settlement delay:** Tiền trong channel chưa phải tiền on-chain. Merchant thấy "paid" nhưng thực ra là credit trong channel.

## Target users

- Developer muốn thêm Fiber payment vào app (Next.js, React, Node.js)
- Hackathon participants muốn demo Fiber payment mà không setup node
- Merchant muốn nhận CKB/RUSD testnet payments

## So sánh với fiber-checkout

| | fiber-checkout | Fiber Gateway |
|---|---|---|
| Developer cần chạy node? | Có | Không |
| Developer cần quản lý liquidity? | Có | Không |
| Có API key system? | Không | Có |
| Có webhook? | Không | Có |
| Custodial? | Không (self-custody) | Có (prototype) |