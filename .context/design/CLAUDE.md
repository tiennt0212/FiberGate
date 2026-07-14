# FiberGate Developer Dashboard — Project Context

## Product
**FiberGate** — a self-hosted, open-source, single-tenant merchant payment gateway for Fiber Network (CKB blockchain). Each deployment serves exactly 1 merchant, self-deployed via `docker-compose`. Not a multi-tenant SaaS, no Stripe-style API key system.

## Tech stack (production)
- Next.js 14 App Router
- Tailwind CSS v3 (`!` suffix for important overrides)
- Ant Design v5 (main component library — see COMPONENTS.dc.html)
- lucide-react for icons
- Desktop-first (1280px+)

## Files in this project
| File | Description |
|------|------|
| `FiberGate.dc.html` | Full dashboard mockup — 4 screens: Overview, Webhooks, Transactions, Quick Start |
| `DESIGN.md` | Design tokens: color, typography, spacing, border radius, component patterns |
| `COMPONENTS.dc.html` | Visual catalog — 11 component patterns mapped to Antd v5 components + override recipes |

## Screens already designed (FiberGate.dc.html)
1. **Overview** — 4 metric cards, an **Invoice Funnel (30d)** row (Pending → Paid %, Pending → Expired %, Avg. Time to Payment — shows whether invoices are "converting" or getting abandoned), Node Status (inbound/outbound capacity bars, pulse dot, Peers count = the real peer count from Peers), Recent Transactions table
2. **Channels** *(new)* — a table listing each payment channel: peer (truncated), asset (CKB or a UDT like RUSD — inferred from whether `fundingUdtTypeScript` is present), local balance (outbound) / remote balance (inbound, rounded), state (Active/Disabled/Closing — using the same badge language as invoice status). A static mini-diagram sits at the top of the page (a central node + spokes to each peer, colored by state: green=active, orange=closing, gray=disabled/no channel). Clicking a row opens a **Drawer** (Antd Drawer, sliding right-to-left) showing: the full channel ID, the full peer pubkey + a "View peer →" link jumping to Peers, detailed state (the Fiber state name, e.g. `CHANNEL_READY`/`SHUTTING_DOWN`, with a plain-language explanation), exact unrounded local/remote balance, in-flight TLCs (offered/received) if > 0 with an explanation of why available capacity is lower than balance, public/private, creation date, fee rate (millionths + %), the channel outpoint + a link to the funding tx hash on the CKB explorer (pudge.explorer.nervos.org), and the shutdown tx hash if it's closing.
3. **Peers** *(new)* — a table listing ONLY the 2 columns backed by real data from `listPeers()`: pubkey + address (multiaddr) — no invented columns. Clicking a peer opens a **Drawer** (sliding right-to-left) showing: the full pubkey/address, total capacity (local+remote summed across every channel with this peer — the real liquidity figure an admin needs), and a list of every open channel with that peer (derived by matching pubkey, each channel showing a truncated state + balance, clicking jumps to the corresponding Channel Drawer).
4. **Webhooks** — added a **Delivery Health** stat-card group at the top of the page: Delivery Success Rate (24h) + a "Needs Attention" warning card (the endpoint with the highest failure rate, name/URL + fail %, amber Warning Banner style, dynamically derived from the lowest-rate endpoint in the list) — helps catch a broken webhook before a payment notification gets lost. Below that: the endpoint list + delivery history panel, an Add Endpoint modal (events: payment.paid / invoice.expired / invoice.failed / * all events)
5. **Activity** *(new)* — a real-time log feed of the poller + webhook delivery inside the fibergate-core process (polling every 3s, with a "Live · next poll in Ns" countdown). Each line: timestamp (hour:minute:second, monospace), source (poller = indigo dot, webhook = purple dot), message, level (error entries stand out: light red background + ERROR badge).
6. **Transactions** — an Invoices tab (filter by status + asset, a Receipt button on paid rows) + a Settlement log tab
7. **Quick Start** — 5 steps: Deploy → Login → Install SDK → Create Invoice → Configure Webhook

## Key design tokens
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
- **Events**: `payment.paid`, `invoice.expired`, `invoice.failed` (no channel.opened/closed)
- **Auth**: no API key UI — `FIBERGATE_INTERNAL_SECRET` set via an env var

## SDK snippet (Quick Start)
```js
const gateway = new FiberGate({
  baseUrl: process.env.FIBERGATE_BASE_URL,
  internalSecret: process.env.FIBERGATE_INTERNAL_SECRET,
});
```

## Removed (not being redesigned)
- API Keys screen (list/create/revoke key) — this concept no longer exists
- Environment switcher (Live/Test) in the sidebar
- Multi-tenant account system (dev@example.com / Free plan)

## Mood & References
- Close to: Stripe Dashboard, Vercel Dashboard, Supabase Studio
- Avoid: crypto-themed (dark neon), over-engineered animations, flashy UI
- Feel: trustworthy, minimal, developer-friendly
