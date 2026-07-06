# FiberGate Developer Dashboard — Project Context

## Sản phẩm
**FiberGate** — self-hosted, open-source, single-tenant merchant payment gateway cho Fiber Network (CKB blockchain). Mỗi deployment phục vụ đúng 1 merchant, tự deploy bằng `docker-compose`. Không phải multi-tenant SaaS, không có API key system kiểu Stripe.

## Stack kỹ thuật (production)
- Next.js 14 App Router
- Tailwind CSS v3 (suffix `!` cho important overrides)
- Ant Design v5 (component library chính — xem COMPONENTS.dc.html)
- lucide-react cho icons
- Desktop-first (1280px+)

## Files trong project
| File | Mô tả |
|------|-------|
| `FiberGate.dc.html` | Mockup dashboard đầy đủ — 4 screens: Overview, Webhooks, Transactions, Quick Start |
| `DESIGN.md` | Design tokens: color, typography, spacing, border radius, component patterns |
| `COMPONENTS.dc.html` | Visual catalog — 11 component patterns mapped sang Antd v5 component + override recipe |

## Screens đã design (FiberGate.dc.html)
1. **Overview** — 4 metric cards, Node Status (inbound/outbound capacity bars, pulse dot), Recent Transactions table
2. **Webhooks** — endpoint list + delivery history panel, Add Endpoint modal (events: payment.paid / invoice.expired / invoice.failed / * all events)
3. **Transactions** — tab Invoices (filter status + asset, Receipt button trên paid rows) + tab Settlement log
4. **Quick Start** — 5 bước: Deploy → Login → Install SDK → Create Invoice → Configure Webhook

## Design tokens chính
- **Accent**: `#4f46e5` (indigo), hover `#4338ca`
- **Background**: `#f7f7f8` (page), `#ffffff` (surface)
- **Border**: `#e4e4e7` (card), `#f3f4f6` (table row divider)
- **Text**: `#141414` (primary), `#71717a` (muted), `#a1a1aa` (subtle)
- **Font UI**: DM Sans · **Font Code**: JetBrains Mono
- **Status badges**: paid `#dcfce7`/`#15803d` · pending `#fef9c3`/`#854d0e` · expired `#f3f4f6`/`#374151` · failed `#fee2e2`/`#991b1b`

## Domain-specific
- **Invoice status**: pending / paid / expired / failed
- **Asset types**: CKB, RUSD (extensible)
- **Node status**: online / degraded / offline (pulse-dot animation)
- **Capacity**: inbound (bar `#4f46e5`) / outbound (bar `#7c3aed`)
- **Events**: `payment.paid`, `invoice.expired`, `invoice.failed` (không có channel.opened/closed)
- **Auth**: không có API key UI — `FIBERGATE_INTERNAL_SECRET` set qua env var

## SDK snippet (Quick Start)
```js
const gateway = new FiberGate({
  baseUrl: process.env.FIBERGATE_BASE_URL,
  internalSecret: process.env.FIBERGATE_INTERNAL_SECRET,
});
```

## Đã loại bỏ (không design lại)
- API Keys screen (list/create/revoke key) — không còn khái niệm này
- Environment switcher (Live/Test) trong sidebar
- Multi-tenant account system (dev@example.com / Free plan)

## Mood & References
- Gần giống: Stripe Dashboard, Vercel Dashboard, Supabase Studio
- Tránh: crypto-themed (dark neon), over-engineered animations, flashy UI
- Cảm giác: trustworthy, minimal, developer-friendly
