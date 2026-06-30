---
type: index
version: 1.0
last_updated: 2026-06-30
---

# Fiber Gateway — Context Index

Đây là Single Source of Truth cho toàn bộ project. Claude Code nên đọc file này trước tiên.

## Dự án là gì?

**Fiber Gateway** là một Lighting Service Provider (LSP) prototype cho Fiber Network (CKB blockchain). Tương tự Stripe nhưng cho Fiber payments: developer đăng ký → nhận API key → gọi REST API để tạo invoice và nhận thanh toán — không cần tự chạy Fiber node.

Dự án được xây dựng cho **Gone in 60ms: Fiber Network Infrastructure Hackathon** (1–15 July 2026), category: Merchant, Liquidity, LSP, and Multi-Asset Infrastructure.

## Cây context

| File | Nội dung |
|------|----------|
| `glossary/fiber-terms.md` | Thuật ngữ Fiber Network, CKB, payment channel |
| `business-context/project-vision.md` | Vision, scope, trade-offs, hackathon constraints |
| `architecture/system-design.md` | Kiến trúc hệ thống, data flow, tech stack |
| `data-dictionary/database-schema.md` | Toàn bộ Supabase tables, columns, relations |
| `api/rest-api-spec.md` | REST API spec đầy đủ (request/response/errors) |
| `business-rules/payment-rules.md` | Logic xử lý invoice, webhook, rate limiting |
| `user-stories/developer-flows.md` | User stories từ góc nhìn developer tích hợp |

## Monorepo layout

- `apps/web` — Next.js 14 App Router, dashboard + API routes
- `packages/sdk` — npm package `@fiber-gateway/sdk`, TypeScript

## Quy ước code

- TypeScript strict mode toàn bộ
- Tên hàm: camelCase. Tên type/interface: PascalCase
- API response luôn theo format: `{ data, error, meta }`
- Mọi Supabase query phải có error handling rõ ràng
- Không hardcode secrets — dùng environment variables