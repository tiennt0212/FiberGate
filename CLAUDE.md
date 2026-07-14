# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Đây là project gì?

**FiberGate** — self-hosted merchant payment gateway framework prototype cho Fiber Network hackathon (1–15 July 2026). Mô tả đầy đủ: xem `README.md`.

> **Constraint cho agent**: Không gọi đây là "LSP framework" — không cung cấp dịch vụ liquidity/mở channel hộ bên thứ ba. Single-tenant: mỗi deployment phục vụ đúng 1 merchant, không có multi-tenant API key/account system — ảnh hưởng trực tiếp tới auth pattern (xem "Auth flow cho API routes" bên dưới: 1 shared secret, không lookup theo user/client).

Đọc `.context/INDEX.md` trước tiên, sau đó đọc theo thứ tự:

1. `.context/glossary/fiber-terms.md` — Thuật ngữ (quan trọng để không hallucinate)
2. `.context/business-context/project-vision.md` — Vision, scope, hackathon constraints
3. `.context/architecture/system-design.md` — Kiến trúc, data flow, tech stack, env vars
4. `.context/data-dictionary/database-schema.md` — PostgreSQL tables, columns, relations
5. `.context/api/rest-api-spec.md` — API spec đầy đủ (request/response/errors)
6. `.context/business-rules/payment-rules.md` — Logic nghiệp vụ, rate limits, security rules
7. `.context/processes/decisions-log.md` — Quyết định đã được human chốt
8. `.context/processes/gotchas.md` — Infra/protocol gotchas đã tốn công tìm ra
9. `.context/processes/definition-of-done.md` — DoD và checklist cuối phiên

## Monorepo layout

> Bản canonical duy nhất — `README.md`/`.context/INDEX.md` chỉ tóm tắt/link về đây.

```
apps/web/          — Next.js 14 App Router (fibergate-core: dashboard + API routes)
  app/(dashboard)/ — Protected routes (single-admin password gate): /dashboard, /webhooks, /transactions
  app/api/v1/      — REST API endpoints: /invoices, /node
  app/api/cron/    — Optional manual-trigger endpoint: /poll-invoices (nguồn chính là in-process interval worker)
  lib/db/          — Drizzle client + schema + helpers
  lib/fiber/       — Fiber JSON-RPC client (wraps FNN node calls)
  lib/services/    — Business logic route.ts delegates to (xem "Service layer pattern" bên dưới)
apps/demo-storefront/ — Reference merchant app (issue #12) — app hoàn toàn tách biệt
  khỏi apps/web, KHÔNG import code chung, chỉ gọi @fibergate/sdk qua HTTP
  (FIBERGATE_BASE_URL/FIBERGATE_INTERNAL_SECRET) giống một merchant thứ ba thật —
  demo QR checkout + nhận webhook thật (POST /api/webhook, verify bằng SDK's
  verifyWebhookSignature) đẩy update qua Server-Sent Events. Có Dockerfile +
  docker-compose.demo.yml riêng ngay trong thư mục này (không nằm ở docker/ gốc —
  tự chứa hoàn toàn). Xem docs/merchants/demo-storefront.md.
packages/sdk/      — npm package @fibergate/sdk (TypeScript, tsup)
packages/create-fibergate/ — npm package `create-fibergate` (issue #48):
                     `npx create-fibergate@latest` — interactive wizard
                     (@clack/prompts) scaffolding a merchant deploy directory
                     from docker-compose.release.yml, generating `.env`
                     (secrets via Node's crypto, admin password bcrypt-hashed
                     via bcryptjs) and placing the CKB testnet key, so a
                     merchant never hand-edits `.env`/hand-runs
                     `openssl rand`/`htpasswd` by hand (that flow is retired —
                     see docs/merchants/quickstart.md). Also validates a passphrase against an
                     already-encrypted key reused from a prior deploy
                     (offline, mirroring fnn's own scrypt+AES-256-GCM key
                     file format — see lib/ckb-key-crypto.ts) before writing
                     anything. `templates/` (gitignored) is auto-copied at
                     build time from docker-compose.release.yml,
                     docker/fiber-node/config.yml,
                     docker/nginx/nginx.conf.template, and
                     .env.release.example — see scripts/copy-templates.mjs —
                     so it can never drift from those files.
docker-compose.yml — Fiber node + PostgreSQL + fibergate-core + nginx/certbot (TLS/WSS
                     reverse proxy, issue #17 — xem CKB/Fiber References bên dưới),
                     build fibergate-core từ source — dùng cho contributor/dev, không
                     phải đường deploy merchant khuyến nghị (xem dòng dưới)
docker-compose.release.yml — issue #21 + #41: cùng 6 service như docker-compose.yml,
                     nhưng fibergate-core dùng image: ghcr.io/<GHCR_NAMESPACE>/
                     fibergate-core (published qua .github/workflows/docker-publish.yml,
                     tag theo git commit SHA + latest) thay vì build: — merchant chỉ cần
                     file này + .env, không cần clone repo, xem docs/merchants/deployment.md
.github/workflows/docker-publish.yml — build + push fibergate-core lên GHCR mỗi lần
                     push canary (+ workflow_dispatch để trigger thủ công)
docker/            — docker/fibergate-core/Dockerfile, config fiber-node,
                     docker/nginx/nginx.conf.template (nginx + certbot service, TLS
                     cho fibergate-core dashboard/API + WSS cho fiber-node P2P — KHÔNG
                     front apps/demo-storefront, xem docs/merchants/public-https-deploy.md)
docs/              — Documentation dành cho người (không phải AI), chia theo audience —
                     xem README.md's bảng "Documentation" để biết file nào cho ai:
                     docs/merchants/* (deploy/quickstart/demo-storefront), docs/maintainers/*
                     (local dev/release process), docs/common/troubleshooting.md (lỗi
                     thường gặp, dùng chung), docs/decisions-and-tradeoffs.md (bản tường
                     thuật cho giám khảo/reviewer — không thay thế .context/processes/
                     decisions-log.md, chỉ là bản đọc dễ hơn của nó)
CONTRIBUTING.md, CODE_OF_CONDUCT.md, MAINTAINER.md — quy ước đóng góp/release, ở root
                     theo convention GitHub tự nhận diện
.context/          — Project context files (Single Source of Truth)
.context/design/   — Mockup UI đầy đủ, commit thẳng vào repo (không chỉ token nữa):
                     - FiberGate.dc.html — mockup dashboard thật (mở trực tiếp bằng browser)
                     - COMPONENTS.dc.html — artboard catalog: từng component pattern trong DESIGN.md
                       render trực quan kèm caption map sang Antd v5 component + cách override
                       (Card/Tag/Table/Button/Segmented/Progress/Alert/Badge/Modal/Menu...) — mở bằng
                       browser để tra khi code UI, đỡ phải tự đoán nên dùng component Antd nào
                     - support.js — script phụ trợ cho mockup
                     - DESIGN.md — design tokens/type scale/component patterns (reference khi code UI)
                     Nguồn gốc: Claude Design (project ID ở trên), nhưng do giới hạn chia sẻ với
                     teammate nên bản trong repo mới là bản dùng được cho cả team. Human tự đồng bộ
                     thủ công khi có thay đổi bên Claude Design — bản trong repo có thể trễ hơn bản
                     gốc, không tự động mirror real-time.
```

## Project IDs

| Service | ID | Ghi chú |
|---------|-----|---------|
| Claude Design | `15b01139-c51f-472e-81df-e7c0777dd47d` | UI mockups |

## Commands

```bash
pnpm install                    # install tất cả packages
pnpm dev                        # chạy apps/web dev server
pnpm build                      # build tất cả
pnpm lint                       # lint toàn bộ
pnpm --filter web typecheck     # TypeScript strict check cho web app
pnpm --filter sdk build         # build chỉ sdk package
pnpm --filter create-fibergate build  # build CLI (chạy scripts/copy-templates.mjs trước tsup)
pnpm --filter web dev           # chạy chỉ web app
pnpm docker:dev                 # chạy dev mode: chỉ postgres + fiber-node (không có fibergate-core)
pnpm docker:dev:down            # dừng postgres + fiber-node ở dev mode

docker compose up -d            # build + chạy fiber-node + postgres + fibergate-core
docker compose build             # rebuild image fibergate-core sau khi đổi code
```

## Kiến trúc và patterns quan trọng (apps/web)

Xem `apps/web/CLAUDE.md` — Auth flow cho API routes, Service layer pattern, Database pattern, Fiber RPC calls, Poller và cron endpoint, Response format.

## Rules quan trọng

- **KHÔNG** tự thêm dependencies mà không hỏi
- **KHÔNG** hardcode bất kỳ secret hay URL nào — dùng env vars (xem list trong `.context/architecture/system-design.md`)
- **KHÔNG** tự sửa database schema mà không update `.context/data-dictionary/database-schema.md`
- Schema Drizzle phải khớp với `.context/data-dictionary/database-schema.md` — sửa file nào cũng phải đồng bộ file kia
- Mọi API route `/api/v1/*` phải validate authentication **trước** khi thực hiện bất kỳ logic nào khác
- Error handling phải explicit — không dùng `try/catch` rỗng
- TypeScript strict mode toàn bộ — không dùng `any`
- Khi tạo git commit cho nhiều thay đổi độc lập nhau (nhiều file/nhiều mục đích khác nhau trong cùng phiên), tách thành nhiều commit nhỏ theo từng đơn vị thay đổi — **không** dồn tất cả vào 1 commit lớn, kể cả khi user chỉ yêu cầu 1 lần "commit giúp tôi"

## Gotchas đã tốn công tìm ra

Chi tiết đầy đủ + cách đã verify: `.context/processes/gotchas.md`. Đừng lặp lại:

- `0.0.0.0` bị `fnn` coi là "public" dù trong Docker network riêng
- `.env` corrupt ký tự `$` (2 cách khác nhau, tùy reader)
- `ckb-cli` export key xuất sai format `fnn` cần
- `pubsub` không nằm trong `enabled_modules` mặc định của FNN
- `subscribe_store_changes`'s subscription id là JSON number, không phải string
- RUSD/UDT cache có thể stale-forever / request-storm race
- Invoice `expired` không reverse được dù payment thật settle sau đó (issue #51)
- Docker Compose không tự forward toàn bộ `.env` vào container — phải liệt kê tường minh trong `environment:` block
- `env_file:` trong override compose file resolve path theo project directory, không phải thư mục chứa file override

## CKB/Fiber References

Khi cần thông tin về CKB protocol hoặc Fiber Network, tra cứu theo thứ tự:

1. `.context/glossary/fiber-terms.md` — thuật ngữ đã được curate cho project này
2. CKB AI MCP (đã cài) — query trực tiếp bằng ngôn ngữ tự nhiên
3. `https://docs.nervos.org/llms.txt` — CKB docs tổng quan
4. `https://www.fiber.world/docs` — Fiber docs chính thức

**Fiber Gateway chỉ dùng Fiber ở application layer (JSON-RPC calls). KHÔNG viết CKB Scripts. KHÔNG cần hiểu Cell Model trừ khi debug channel issues.**

### SDK/tooling — official vs community (theo `fiber-hackathon-docs/resources.md`)

- **Official, dùng cho core (Phase 1/2):** `@ckb-ccc/fiber` (SDK cho `lib/fiber/client.ts`), `fnn-cli` + `ckb-cli` (setup/bootstrap channel lúc dev, không phải runtime dependency của app).
- **Community, chỉ dùng làm reference cho Phase 3 (L402, optional stretch) — riêng cho `apps/web`:** `@fiber-pay/sdk` — xem demo tham chiếu [`fiber-l402`](https://github.com/RetricSu/fiber-l402) (Express + Astro + React, dùng chính thư viện này để build L402 paywall middleware). **Không dùng `@fiber-pay/react` trong `apps/web`/`fibergate-core`.**
- **`apps/demo-storefront` (app tách biệt hoàn toàn) có dùng `@fiber-pay/react` + `@nervosnetwork/fiber-js` thật** — nút "Pay with browser wallet", chạy 1 Fiber node WASM ngay trong browser. Xem `apps/demo-storefront/app/BrowserWalletPay.tsx`, `docs/merchants/demo-storefront.md`. Lý do/lịch sử: `decisions-log.md` 2026-07-08 (issue #12).
- **Fiber WSS Config Manual** (`nervosnetwork/fiber/blob/v0.9.0-rc6/docs/fiber-node-wss.md`, pin đúng tag khớp image đang dùng) — hướng dẫn expose P2P của node qua `wss://` (Nginx+TLS) cho browser/WASM client. **Không áp dụng cho `fibergate-core` tự thân**: gọi JSON-RPC tới `fiber-node` qua docker internal network (plain HTTP), không cần TLS/WSS. `docker-compose.yml`'s `nginx` service implement recipe này (`stream{}` + `ssl_preread` trên port `8228`, phân biệt raw TCP P2P thường vs TLS/WSS browser) — cần `DOMAIN` cấu hình + `docker/fiber-node/config.yml`'s `announced_addrs` thêm dòng `/dns4/<DOMAIN>/tcp/8228/wss` thủ công. **Chưa live-verify qua domain thật/Let's Encrypt/browser wallet thật** — mới smoke-test local với cert self-signed (`DOMAIN=localhost`). Chi tiết kiến trúc: `system-design.md`'s "TLS/WSS reverse proxy (nginx + certbot)"; runbook: `docs/merchants/public-https-deploy.md`; lịch sử: `decisions-log.md` 2026-07-09 (issue #17).

## Nguyên tắc làm việc với AI Agent

### Hỏi trước khi làm
Khi gặp yêu cầu chưa rõ hoặc có nhiều cách tiếp cận, Claude Code
**KHÔNG tự suy đoán rồi implement**. Thay vào đó:

1. Nêu rõ phần nào còn ambiguous
2. Đặt câu hỏi cụ thể để làm rõ
3. Nếu cần, đề xuất 2-3 options và hỏi chọn cái nào
4. Chỉ implement sau khi nhận được câu trả lời

**Ví dụ tình huống cần hỏi:**
- Yêu cầu mô tả feature nhưng không rõ edge case
- Có thể implement theo nhiều cách với trade-off khác nhau
- Không chắc scope: "tạo webhook" là chỉ backend hay cả UI?
- Không rõ behavior khi error: retry hay fail ngay?

### Không tự quyết định các vấn đề sau (dừng và hỏi):
- Thay đổi database schema
- Thay đổi API response format (breaking change)
- Cài thêm dependency mới
- Xóa code hoặc file hiện có
- Bất kỳ logic liên quan đến security, auth, signing, hashing
- Chọn kiến trúc khi có nhiều hướng khả thi

## Khi implement một feature mới

1. Đọc user story liên quan trong `.context/user-stories/`
2. Đọc business rules liên quan trong `.context/business-rules/`
3. Implement theo API spec trong `.context/api/rest-api-spec.md`
4. Nếu là UI/dashboard: đối chiếu `.context/design/FiberGate.dc.html` (mockup thật, mở bằng browser),
   `.context/design/DESIGN.md` (tokens/component patterns), và `.context/design/COMPONENTS.dc.html`
   (component nào trong mockup nên dựng bằng Antd component nào + cách override) — không tự bịa
   màu sắc/spacing, và không tự dựng lại component mà Antd đã có sẵn
5. Update context file nếu có thay đổi design
6. Trước khi coi là xong: đối chiếu `.context/processes/definition-of-done.md` — đừng dừng lại chỉ vì code "trông có vẻ xong"
