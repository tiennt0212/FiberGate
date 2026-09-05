# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this project?

**FiberGate** — a self-hosted merchant payment gateway framework prototype for the Fiber Network hackathon (1–15 July 2026). Full description: see `README.md`.

> **Constraint for the agent**: Don't call this an "LSP framework" — it doesn't provide liquidity/channel-opening services on behalf of a third party. Single-tenant: each deployment serves exactly 1 merchant, with no multi-tenant API key/account system — this directly affects the auth pattern (see "Auth flow for API routes" in `apps/web/CLAUDE.md`: 1 shared secret, no lookup by user/client).

Read `.context/INDEX.md` first, then read in this order:

1. `.context/glossary/fiber-terms.md` — Terminology (important to avoid hallucination)
2. `.context/business-context/project-vision.md` — Vision, scope, hackathon constraints
3. `.context/architecture/system-design.md` — Architecture, data flow, tech stack, env vars
4. `.context/data-dictionary/database-schema.md` — PostgreSQL tables, columns, relations
5. `.context/api/rest-api-spec.md` — Full API spec (request/response/errors)
6. `.context/business-rules/payment-rules.md` — Business logic, rate limits, security rules
7. `.context/processes/decisions-log.md` — Decisions already settled by a human
8. `.context/processes/gotchas.md` — Infra/protocol gotchas that took real effort to find
9. `.context/processes/definition-of-done.md` — DoD and end-of-session checklist

## Monorepo layout

> The single canonical version — `README.md`/`.context/INDEX.md` only summarize/link back here.

```
apps/web/          — Next.js 14 App Router (fibergate-core: dashboard + API routes)
  app/(dashboard)/ — Protected routes (single-admin password gate): /dashboard, /webhooks, /transactions
  app/api/v1/      — REST API endpoints: /invoices, /node
  app/api/cron/    — Optional manual-trigger endpoint: /poll-invoices (primary source is the in-process interval worker)
  lib/db/          — Drizzle client + schema + helpers
  lib/fiber/       — Fiber JSON-RPC client (wraps FNN node calls)
  lib/services/    — Business logic route.ts delegates to (see "Service layer pattern" in apps/web/CLAUDE.md)
apps/demo-storefront/ — Reference merchant app, fully separate from apps/web: does NOT import
                     shared code, only calls @fibergate/sdk over HTTP exactly like a real
                     third-party merchant. Self-contained (own Dockerfile +
                     docker-compose.demo.yml here, not in root docker/).
                     See docs/merchants/demo-storefront.md.
packages/sdk/      — npm package @fibergate/sdk (TypeScript, tsup)
packages/create-fibergate/ — npm package `create-fibergate`: the merchant scaffolding wizard.
                     `templates/` is gitignored and auto-copied at build time from
                     docker-compose.release.yml, docker/fiber-node/config.yml,
                     docker/nginx/nginx.conf.template and .env.release.example
                     (scripts/copy-templates.mjs). So: DO NOT edit templates/ directly, and
                     after changing any of those four run `pnpm create-fibergate:dev` — a
                     plain `node dist/cli.js` scaffolds STALE templates.
docker-compose.yml — 6 services, builds fibergate-core from source. Contributor/dev path.
docker-compose.release.yml — same 6 services, but pulls fibergate-core from GHCR instead of
                     building. The recommended merchant path (this file + .env, no clone) —
                     see docs/merchants/deployment.md
.github/workflows/docker-publish.yml — pushes fibergate-core to GHCR on every push to canary
docker/            — fibergate-core Dockerfile, fiber-node config, nginx.conf.template
                     (TLS for the dashboard/API + WSS for fiber-node P2P; does NOT front
                     apps/demo-storefront — see docs/merchants/public-https-deploy.md)
docs/              — Human-facing docs, not written for the agent. Audience map: the
                     "Documentation" table in README.md.
.context/          — Project context files (Single Source of Truth)
.context/design/   — FiberGate.dc.html (dashboard mockup) + COMPONENTS.dc.html (which Antd
                     component to use for each pattern) + DESIGN.md (tokens) + support.js.
                     How to use them when coding UI: "When implementing a new feature" below.
                     Origin: Claude Design project 15b01139-c51f-472e-81df-e7c0777dd47d,
                     synced by hand — the repo copy may lag behind.
CONTRIBUTING.md, CODE_OF_CONDUCT.md, MAINTAINER.md — contribution/release conventions
```

## Commands

```bash
pnpm install                    # install all packages
pnpm dev                        # run the apps/web dev server
pnpm build                      # build everything
pnpm lint                       # lint everything
pnpm --filter web typecheck     # TypeScript strict check for the web app
pnpm --filter sdk build         # build only the sdk package
pnpm --filter create-fibergate build  # build the CLI (runs scripts/copy-templates.mjs before tsup)
pnpm create-fibergate:dev /tmp/try-wizard  # rebuild the CLI, then run the wizard into a throwaway dir
pnpm --filter web dev           # run only the web app
pnpm docker:dev                 # run dev mode: only postgres + fiber-node (no fibergate-core)
pnpm docker:dev:down            # stop postgres + fiber-node in dev mode

docker compose up -d            # build + run fiber-node + postgres + fibergate-core
docker compose build             # rebuild the fibergate-core image after code changes
```

## Key architecture and patterns (apps/web)

See `apps/web/CLAUDE.md` — Auth flow for API routes, Service layer pattern, Database pattern, Fiber RPC calls, Poller and cron endpoint, Response format.

## Important rules

- **DO NOT** add dependencies without asking first
- **DO NOT** hardcode any secret or URL — use env vars (see the list in `.context/architecture/system-design.md`)
- **DO NOT** modify the database schema without updating `.context/data-dictionary/database-schema.md`
- The Drizzle schema must match `.context/data-dictionary/database-schema.md` — editing one requires syncing the other
- Every `/api/v1/*` API route must validate authentication **before** doing any other logic
- Error handling must be explicit — no empty `try/catch` blocks
- TypeScript strict mode throughout — no `any`
- When creating a git commit for multiple independent changes (multiple files/multiple different purposes in the same session), split them into multiple small commits per unit of change — **do not** lump everything into one big commit, even if the user only asks once to "commit this for me"
- When editing a file that has a public mirror on the VitePress site (see the "Public docs mirror" table in `.context/INDEX.md`), also check/update the corresponding `docs/*.md` page in the same edit — the two don't auto-sync

## Gotchas that took real effort to find

Full details + how they were verified: `.context/processes/gotchas.md`. Don't repeat these:

- `0.0.0.0` is treated as "public" by `fnn` even inside a private Docker network
- A Fiber node announcing no *reachable* address is banned by every peer — silently, and it can never be paid (announced via `FIBER_ANNOUNCED_ADDRS`, derived from `DOMAIN` in compose, never hardcoded in `config.yml`)
- Env-var changes in `.env` need `docker compose up -d <svc>`; `restart` reuses the old values
- A CDN proxy (Cloudflare orange cloud) drops P2P port 8228 at the edge while 443 keeps working — use a DNS-only record via `FIBER_P2P_DOMAIN`
- `openssl s_client` says `Verify return code: 0 (ok)` even on a hostname mismatch — pass `-verify_hostname` or the check is meaningless
- `.env` corrupts the `$` character (2 different ways, depending on the reader)
- `ckb-cli` key export produces the wrong format for what `fnn` needs
- `pubsub` is not in FNN's default `enabled_modules`
- `subscribe_store_changes`'s subscription id is a JSON number, not a string
- The RUSD/UDT cache can go stale-forever / hit a request-storm race
- An `expired` invoice can't be reversed even if the real payment later settles (issue #51)
- Docker Compose doesn't automatically forward the entire `.env` into the container — must be explicitly listed in the `environment:` block
- `env_file:` in an override compose file resolves its path relative to the project directory, not the directory containing the override file

## CKB/Fiber References

When you need information about the CKB protocol or Fiber Network, look it up in this order:

1. `.context/glossary/fiber-terms.md` — terminology already curated for this project
2. CKB AI MCP (already installed) — query directly in natural language
3. `https://docs.nervos.org/llms.txt` — general CKB docs
4. `https://www.fiber.world/docs` — official Fiber docs

**FiberGate only uses Fiber at the application layer (JSON-RPC calls). Do NOT write CKB Scripts. No need to understand the Cell Model unless debugging channel issues.**

### SDK/tooling — official vs community

Reasons and history: `decisions-log.md` 2026-07-01 (SDK choice), 2026-07-08 (issue #12), 2026-07-09 (issue #17).

- **The core (`apps/web`) uses the official `@ckb-ccc/fiber`.** `fnn-cli` + `ckb-cli` are dev-time setup tools, not runtime dependencies of the app.
- **Do NOT use `@fiber-pay/react` in `apps/web`/`fibergate-core`.** `@fiber-pay/sdk` is a reference for Phase 3 (L402, optional stretch) only — see the [`fiber-l402`](https://github.com/RetricSu/fiber-l402) demo.
- **`apps/demo-storefront` is the exception** and does use `@fiber-pay/react` + `@nervosnetwork/fiber-js` — the "Pay with browser wallet" button runs a Fiber node WASM in the browser. See `apps/demo-storefront/app/BrowserWalletPay.tsx`.
- **TLS/WSS applies to `fiber-node`'s P2P, NOT to `fibergate-core`**, which calls JSON-RPC over the docker internal network in plain HTTP. The `/wss` announced address derives automatically from `DOMAIN` (or `FIBER_P2P_DOMAIN`) — never hand-edit `config.yml`. Transport verified against a real cert 2026-09-04; a browser wallet completing a payment over it is still unverified. Runbook: `docs/merchants/public-https-deploy.md`.

## Principles for working with the AI Agent

### How to communicate

These govern *how* work is reported, not what work is done. They apply to every report, question, and explanation — including the two subsections below.

**Presentation.** Match the form to the content: a table when comparing along shared axes, bullets only for parallel items with no logic between them, prose for anything with a *because* or a *but* in it — bullets shred an argument into fragments the reader has to reassemble. Concrete before abstract: show the case, then name the rule. Anchor a new idea to one the reader already holds ("same as X, except Y"). Ration bold — three in a paragraph point at nothing. Signpost anything long before starting it, and reserve code blocks for actual code. One idea per sentence — compression is not clarity, and four clauses packed into one sentence are harder to use than four short ones. When brevity and clarity conflict, clarity wins.

**Language.** Reply in whatever language the user wrote in. Keep technical terms in English regardless — invoice, channel, webhook, poller, migration, standalone. Never translate them ("hóa đơn", "kênh thanh toán" read as machine translation). Drop bureaucratic phrasing ("Tôi đã tiến hành thực hiện việc sửa đổi..." → "Đã sửa..."), and drop social filler ("Câu hỏi hay!", "Hy vọng giúp ích").

**Explanations — say it in the world, not in the code.** Before any mechanism, spend 2–4 short lines on what actually happens and who it happens to. Mechanism explains something the reader has already been made to care about — lead with it and they are decoding, not understanding. Vocabulary from the tooling and from your own process (guard, interpolation, fallback, altitude, finding, nesting, agent) is yours, not theirs: name the effect instead. If `.context/` already documents it (a gotcha, a settled decision, a term), link to that file instead of re-explaining it.

> ❌ "Guard `${DOMAIN:+…}` chỉ chặn DOMAIN rỗng, không chặn `localhost`, nên node vẫn announce."
>
> ✅ "Khi bạn chạy local, `.env` ghi `DOMAIN=localhost`. Node sẽ nói với toàn bộ testnet: 'gọi tôi ở `localhost:8228`'. Nhưng `localhost` trên máy người khác là máy của chính họ. Nên mọi node nghe được đều ghi vào sổ một địa chỉ vô nghĩa."

**Reports.** Lead with the outcome in the user's terms — not a table of contents of what was edited, and not the shape of the process that produced it (which review pass, which agent, which phase; the user is not debugging your workflow). Then at most 3–4 bullets, each with a clickable `file:line`, covering only what changes the user's decisions. Always separate what was actually verified from what is inferred — say "chưa live-verify" explicitly rather than letting a passing typecheck imply the feature works. Close with exactly one thing needed from the user, if there is one.

> ❌ "I have completed the implementation. Summary of changes: — Modified `apps/web/lib/services/invoice.ts` … — Ran `pnpm typecheck`: passed. All changes are complete and verified."
>
> ✅ "Invoice giờ hết hạn đúng thật — nguyên nhân là `new_invoice` thiếu param `expiry`, không phải Fiber không hỗ trợ.
> - `lib/fiber/client.ts:88` — truyền `expiry` (giây) xuống FNN
> - `lib/services/invoice.ts:142` — đọc từ `INVOICE_EXPIRY_SECONDS`, default 900
>
> Typecheck + lint pass. **Chưa live-verify** — cần một invoice thật trên testnet mới chắc FNN tôn trọng param này.
> Cần bạn quyết: bạn tự chạy `docker compose up` thử, hay để tôi dựng?"

**Option questions** — this refines step 3 of "Ask before doing" below. Give a recommendation first with its reason, then the alternatives, then what the user gives up by taking the recommendation. Express every trade-off in domain terms — merchant, invoice state machine, poller, deploy risk — never abstract ones ("more flexible", "cleaner"). One question at a time, phrased so it can be answered in one word. A question that has already gone unanswered once was the wrong question: turn it into a concrete proposal to confirm rather than asking it again.

> ❌ "Option A: revert status. Option B: new invoice. Option C: keep as is. Which would you prefer?"
>
> ✅ "Tôi nghiêng về **B — mở invoice mới, đánh dấu cái cũ `expired_paid`**: giữ audit trail, không phải sửa state machine.
> - **A** (revert về `paid`): sạch cho merchant nhưng phá invariant 'expired là terminal' — poller đang dựa vào đó.
> - **C** (để nguyên): rẻ nhất, nhưng merchant mất tiền trong im lặng — không chấp nhận được với payment gateway."

**Uncertainty.** State it once, plainly, then keep going — no repeated hedging, no apologizing in circles.

### Ask before doing
When facing an unclear request or one with multiple possible approaches, Claude Code
**must NOT guess and implement on its own**. Instead:

1. State clearly which part is ambiguous
2. Ask specific clarifying questions
3. If needed, propose 2-3 options and ask which to choose
4. Only implement after receiving an answer

### Don't decide these on your own (stop and ask):
- Changing the database schema
- Changing the API response format (breaking change)
- Adding a new dependency
- Deleting existing code or files
- Any logic related to security, auth, signing, hashing
- Choosing an architecture when multiple approaches are viable

## When implementing a new feature

1. Read the relevant user story in `.context/user-stories/`
2. Read the relevant business rules in `.context/business-rules/`
3. Implement per the API spec in `.context/api/rest-api-spec.md`
4. If it's UI/dashboard work: cross-reference `.context/design/FiberGate.dc.html` (the real mockup, open in a browser),
   `.context/design/DESIGN.md` (tokens/component patterns), and `.context/design/COMPONENTS.dc.html`
   (which component in the mockup should be built with which Antd component + how to override it) — don't invent
   colors/spacing on your own, and don't rebuild a component Antd already provides
5. Update the context file if there's a design change
6. Before considering it done: cross-check `.context/processes/definition-of-done.md` — don't stop just because the code "looks done"
