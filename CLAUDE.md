# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Đây là project gì?

**Fiber Gateway** là LSP (Lightning Service Provider) prototype cho Fiber Network hackathon (1–15 July 2026).
Tương tự Stripe nhưng cho Fiber payments: developer đăng ký → nhận API key → gọi REST API để tạo invoice và nhận thanh toán — không cần tự chạy Fiber node.

Đọc `.context/INDEX.md` trước tiên, sau đó đọc theo thứ tự:

1. `.context/glossary/fiber-terms.md` — Thuật ngữ (quan trọng để không hallucinate)
2. `.context/business-context/project-vision.md` — Vision, scope, hackathon constraints
3. `.context/architecture/system-design.md` — Kiến trúc, data flow, tech stack, env vars
4. `.context/data-dictionary/database-schema.md` — Supabase tables, columns, relations
5. `.context/api/rest-api-spec.md` — API spec đầy đủ (request/response/errors)
6. `.context/business-rules/payment-rules.md` — Logic nghiệp vụ, rate limits, security rules

## Monorepo layout

```
apps/web/          — Next.js 14 App Router (dashboard + API routes)
  app/(dashboard)/ — Protected routes: /dashboard, /keys, /webhooks, /transactions
  app/api/v1/      — REST API endpoints: /invoices, /node
  app/api/cron/    — Vercel Cron jobs: /poll-invoices
  lib/supabase/    — Supabase client + helpers + generated types
  lib/fiber/       — Fiber JSON-RPC client (wraps FNN node calls)
packages/sdk/      — npm package @fiber-gateway/sdk (TypeScript, tsup)
.context/          — Project context files (Single Source of Truth)
.context/design/   — UI mockups và design decisions
```

## Commands

```bash
pnpm install                    # install tất cả packages
pnpm dev                        # chạy apps/web dev server
pnpm build                      # build tất cả
pnpm lint                       # lint toàn bộ
pnpm --filter web typecheck     # TypeScript strict check cho web app
pnpm --filter sdk build         # build chỉ sdk package
pnpm --filter web dev           # chạy chỉ web app

# Generate Supabase types (chạy sau mỗi khi thay đổi schema)
supabase gen types typescript --project-id <project-id> \
  > apps/web/lib/supabase/types.ts
```

## Kiến trúc và patterns quan trọng

### Auth flow cho API routes

Mọi API route `/api/v1/*` phải validate theo thứ tự:
1. Extract Bearer token từ `Authorization` header
2. Lookup `api_keys` table theo `client_id` (derived từ token)
3. `bcrypt.compare(token, secret_hash)` — **không** so sánh plaintext
4. Lấy `user_id` từ key record để scope mọi Supabase query

API keys: `client_id` = public identifier (prefix `pk_test_`), `api_secret` = private auth token (prefix `sk_test_`). `api_secret` chỉ trả về một lần khi tạo, sau đó chỉ lưu bcrypt hash (`secret_hash`).

### Supabase pattern trong API routes

API routes dùng `service_role` key (bypass RLS) nhưng **phải validate `user_id` thủ công** theo BR-SEC-004:
```typescript
const { data } = await supabaseAdmin
  .from('invoices')
  .select('*')
  .eq('user_id', validatedUserId)  // bắt buộc
```

### Fiber RPC calls

Mọi call đến Fiber node đi qua `lib/fiber/client.ts`. Không call Fiber RPC trực tiếp từ API routes. Response timeout: 5 giây (BR-POL-004).

### Cron endpoint security

`/api/cron/poll-invoices` phải check `Authorization: Bearer ${CRON_SECRET}` header trước khi xử lý. Vercel tự thêm header này khi trigger cron.

### Response format

Tất cả API responses theo format:
```typescript
// Success
{ data: T, error: null, meta?: { ... } }
// Error  
{ data: null, error: { code: string, message: string } }
```

## Rules quan trọng

- **KHÔNG** tự thêm dependencies mà không hỏi
- **KHÔNG** hardcode bất kỳ secret hay URL nào — dùng env vars (xem list trong `.context/architecture/system-design.md`)
- **KHÔNG** tự sửa database schema mà không update `.context/data-dictionary/database-schema.md`
- Tất cả Supabase types phải được generate từ schema thực tế (`supabase gen types`)
- Error handling phải explicit — không dùng `try/catch` rỗng
- TypeScript strict mode toàn bộ — không dùng `any`

## CKB/Fiber References

Khi cần thông tin về CKB protocol hoặc Fiber Network, tra cứu theo thứ tự:

1. `.context/glossary/fiber-terms.md` — thuật ngữ đã được curate cho project này
2. CKB AI MCP (đã cài) — query trực tiếp bằng ngôn ngữ tự nhiên
3. `https://docs.nervos.org/llms.txt` — CKB docs tổng quan
4. `https://www.fiber.world/docs` — Fiber docs chính thức

**Fiber Gateway chỉ dùng Fiber ở application layer (JSON-RPC calls). KHÔNG viết CKB Scripts. KHÔNG cần hiểu Cell Model trừ khi debug channel issues.**

## Khi implement một feature mới

1. Đọc user story liên quan trong `.context/user-stories/`
2. Đọc business rules liên quan trong `.context/business-rules/`
3. Implement theo API spec trong `.context/api/rest-api-spec.md`
4. Update context file nếu có thay đổi design
