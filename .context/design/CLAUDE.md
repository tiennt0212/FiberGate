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
1. **Overview** — 4 metric cards, **Invoice Funnel (30d)** row (Pending → Paid %, Pending → Expired %, Avg. Time to Payment — cho biết invoice có "trôi" hay bị bỏ ngang), Node Status (inbound/outbound capacity bars, pulse dot, Peers count = số peer thật từ Peers), Recent Transactions table
2. **Channels** *(mới)* — bảng liệt kê từng payment channel: peer (rút gọn), asset (CKB hoặc UDT như RUSD — suy ra từ `fundingUdtTypeScript` có/không), local balance (outbound) / remote balance (inbound, đã làm tròn), trạng thái (Active/Disabled/Closing — cùng ngôn ngữ badge với invoice status). Có mini-diagram tĩnh ở đầu trang (node trung tâm + spokes tới từng peer, tô màu theo state: xanh=active, cam=closing, xám=disabled/no channel). Click 1 row → **Drawer** (Antd Drawer, trượt phải→trái) hiển thị: channel ID đầy đủ, peer pubkey đầy đủ + link "View peer →" nhảy sang Peers, trạng thái chi tiết (state name Fiber vd. `CHANNEL_READY`/`SHUTTING_DOWN` kèm giải thích ngôn ngữ thường), local/remote balance chính xác không làm tròn, TLC in-flight (offered/received) nếu > 0 kèm giải thích tại sao capacity khả dụng thấp hơn balance, public/private, ngày tạo, fee rate (millionths + %), channel outpoint + link funding tx hash sang CKB explorer (pudge.explorer.nervos.org), shutdown tx hash nếu đang đóng.
3. **Peers** *(mới)* — bảng liệt kê CHỈ 2 cột đúng dữ liệu thật từ `listPeers()`: pubkey + address (multiaddr) — không thêm cột bịa. Click 1 peer → **Drawer** (trượt phải→trái) hiển thị: pubkey/address đầy đủ, tổng capacity (local+remote cộng dồn mọi channel với peer này — con số thanh khoản thật admin cần), danh sách tất cả channel đang mở với peer đó (derive theo pubkey trùng, mỗi channel show trạng thái + balance rút gọn, click → nhảy sang Channel Drawer tương ứng).
4. **Webhooks** — thêm nhóm stat-card **Delivery Health** ở đầu trang: Delivery Success Rate (24h) + card cảnh báo "Needs Attention" (endpoint có failure rate cao nhất, tên/URL + % fail, style Warning Banner amber, derive động từ rate thấp nhất trong danh sách endpoint) — giúp phát hiện webhook hỏng trước khi mất payment notification. Bên dưới: endpoint list + delivery history panel, Add Endpoint modal (events: payment.paid / invoice.expired / invoice.failed / * all events)
5. **Activity** *(mới)* — feed log real-time của poller + webhook delivery trong tiến trình fibergate-core (poll mỗi 3s, có countdown "Live · next poll in Ns"). Mỗi dòng: timestamp (giờ:phút:giây, mono), source (poller = dot indigo, webhook = dot purple), message, level (error nổi bật: nền đỏ nhạt + badge ERROR).
6. **Transactions** — tab Invoices (filter status + asset, Receipt button trên paid rows) + tab Settlement log
7. **Quick Start** — 5 bước: Deploy → Login → Install SDK → Create Invoice → Configure Webhook

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
