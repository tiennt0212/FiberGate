---
type: index
version: 1.0
last_updated: 2026-06-30
---

# FiberGate — Context Index

Đây là Single Source of Truth cho toàn bộ project. Claude Code nên đọc file này trước tiên.

## Dự án là gì?

**FiberGate** là một self-hosted, open-source merchant payment gateway framework cho Fiber Network (CKB blockchain). Merchant tự deploy bằng `docker compose up -d` (Fiber node + PostgreSQL + FiberGate core) trên hạ tầng của chính mình, rồi gọi REST API nội bộ để tạo invoice và nhận thanh toán — không cần tự viết code kết nối Fiber RPC, quản lý invoice state machine, hay tự build webhook delivery từ đầu.

> Lưu ý naming: không gọi là "LSP framework" — FiberGate không cung cấp dịch vụ liquidity/mở channel hộ bên thứ ba (đúng nghĩa Lightning Service Provider). Đây là merchant payment gateway, khớp với ví dụ "Merchant checkout SDKs, payment processor prototypes... payment status webhooks" trong category 3 của hackathon.

Dự án được xây dựng cho **Gone in 60ms: Fiber Network Infrastructure Hackathon** (1–15 July 2026), category: Merchant, Liquidity, LSP, and Multi-Asset Infrastructure.

## Cây context

| File | Nội dung |
|------|----------|
| `glossary/fiber-terms.md` | Thuật ngữ Fiber Network, CKB, payment channel |
| `business-context/project-vision.md` | Vision, scope, trade-offs, hackathon constraints |
| `architecture/system-design.md` | Kiến trúc hệ thống, data flow, tech stack |
| `data-dictionary/database-schema.md` | Toàn bộ PostgreSQL tables, columns, relations |
| `api/rest-api-spec.md` | REST API spec đầy đủ (request/response/errors) |
| `business-rules/payment-rules.md` | Logic xử lý invoice, webhook, rate limiting |
| `guides/webhook-signature.md` | Giải thích HMAC-SHA256 và cách verify webhook signature |
| `user-stories/developer-flows.md` | User stories từ góc nhìn developer tích hợp |
| `processes/decisions-log.md` | Quyết định kiến trúc và nghiệp vụ đã được human chốt |
| `processes/definition-of-done.md` | DoD và checklist tự verify cuối mỗi AI coding session |

## Monorepo layout

- `apps/web` — Next.js 14 App Router (fibergate-core), dashboard (single-admin) + API routes
- `packages/sdk` — npm package `@fibergate/sdk`, TypeScript
- `docker-compose.yml` — Fiber node + PostgreSQL + fibergate-core, merchant tự deploy

## Quy ước code

- TypeScript strict mode toàn bộ
- Tên hàm: camelCase. Tên type/interface: PascalCase
- API response luôn theo format: `{ data, error, meta }`
- Mọi database query (Drizzle) phải có error handling rõ ràng
- Không hardcode secrets — dùng environment variables