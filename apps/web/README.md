# FiberGate — Web (frontend-only)

Dashboard UI for the FiberGate self-hosted merchant payment gateway. This app
is **pure UI + mock data** — no API routes, no database, no Fiber node / Docker.
Data comes from `lib/mock/data.ts`; swap those for real fetches once the backend
routes exist.

## Stack

- Next.js 14 (App Router) · React 18 · TypeScript (strict)
- Ant Design v5 (`ConfigProvider` theme in `app/theme.ts`) + `@ant-design/nextjs-registry`
- Tailwind CSS v3 — **preflight disabled** so it doesn't fight Antd's own reset
- Design tokens mirror `.context/design/DESIGN.md`

## Commands

```bash
pnpm install            # from repo root (pnpm workspace)
pnpm --filter web dev   # dev server → http://localhost:3000
pnpm --filter web build
pnpm --filter web typecheck
pnpm --filter web lint
```

## Structure

```
app/
  layout.tsx              AntdRegistry + ConfigProvider + fonts
  theme.ts                Antd theme tokens (from DESIGN.md)
  page.tsx                redirect → /dashboard
  login/                  single-admin password gate (UI only)
  (dashboard)/
    layout.tsx            Sidebar + Header shell
    dashboard/            Overview: metrics, capacity, recent tx
    webhooks/             endpoints list + add form + delivery log
    transactions/         filters + invoice table + receipt modal
    quick-start/          onboarding steps + code blocks
components/               shared: Sidebar, Header, InvoiceTable, StatusBadge, …
lib/
  routes.ts               single source of truth for routes + titles
  nav-items.tsx           sidebar menu items
  types/                  domain types (from rest-api-spec + schema)
  mock/                   static mock data
  format.ts               display formatting helpers
```

## Screens

| Route | Screen |
|---|---|
| `/login` | Single-admin password gate |
| `/dashboard` | Overview — metrics, channel capacity, recent transactions |
| `/webhooks` | Endpoints + add form + delivery log |
| `/transactions` | Invoice filters, table, receipt modal, settlement tab |
| `/quick-start` | Integration onboarding steps |

## Not in scope here

API routes (`app/api/v1/*`), Drizzle/PostgreSQL, `lib/fiber` RPC client, Docker,
and the FNN node — those belong to the full monorepo described in
`.context/architecture/system-design.md`.
