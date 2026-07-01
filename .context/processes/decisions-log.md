---
type: decisions_log
version: 1.0
last_updated: 2026-06-30
tags: [decisions, architecture, business-logic, open-questions]
---

# Decisions Log — FiberGate

> Ghi lại các quyết định đã được **human xác nhận**.
> Claude Code cập nhật file này **sau khi** human confirm trong cuộc hội thoại.
> KHÔNG tự thêm khi chưa có xác nhận rõ ràng từ human.
>
> Format: `[YYYY-MM-DD] **Topic**: decision — Lý do: why`

---

## Architecture & Tech Stack

[2026-07-01] **Product framing pivot**: Chuyển FiberGate từ managed custodial LSP (SaaS đa khách hàng) sang self-hosted open-source infrastructure framework — đóng gói docker-compose (Fiber node + PostgreSQL + FiberGate core: Next.js dashboard + API), mỗi merchant tự deploy `docker compose up -d` và giữ node/dữ liệu của họ — Lý do: Hackathon "Gone in 60ms" quy định rõ "infrastructure only, not products built on top"; mô hình SaaS custodial đa khách hàng có rủi ro bị xếp sai category và mất điểm.

[2026-07-01] **Auth model**: Bỏ multi-tenant API key system (`profiles`/`api_keys` table, bcrypt `secret_hash` theo từng client, BR-SEC-004 user_id scoping). Thay bằng 1 lớp internal auth đơn giản: single shared secret `FIBERGATE_INTERNAL_SECRET` (giống pattern `CRON_SECRET` đã có), so sánh constant-time, dùng để app bán hàng của merchant gọi vào FiberGate core khi 2 service không chạy chung host/network — Lý do: Trong self-hosted, mỗi deployment chỉ phục vụ 1 merchant nên phân biệt nhiều client là dư thừa; vẫn cần auth nội bộ tối thiểu để core không bị gọi trái phép khi tách container ra mạng riêng.

[2026-07-01] **Database**: Bỏ Supabase (kể cả bản self-hosted), chuyển sang PostgreSQL thuần (container riêng) + Drizzle ORM — Lý do: Bộ self-hosted Supabase chính thức đóng gói ~10 container (gotrue, postgrest, realtime, storage, kong, studio...), quá nặng so với mục tiêu "3 container gọn nhẹ" của docker-compose bundle; single-tenant nên không cần Supabase Auth/RLS.

[2026-07-01] **Dashboard auth**: Dùng single-admin password gate (đặt qua env var lúc deploy, hash bcrypt, session httpOnly cookie) thay vì Supabase Auth/multi-user login — Lý do: Mỗi deployment chỉ có 1 merchant vận hành, không cần hệ thống user/role.

[2026-07-01] **Fiber client SDK**: `lib/fiber/client.ts` build trên nền `@ckb-ccc/fiber` (official SDK), không tự viết JSON-RPC thô, không dùng `@fiber-pay/sdk` cho core flow — Lý do: `@ckb-ccc/fiber` là SDK chính thức được hackathon khuyến nghị ("best starting point for app integrations"), `@fiber-pay/sdk`/`@fiber-pay/react` là community/experimental, rủi ro hơn cho core flow (Phase 1/2). `@fiber-pay/sdk` được giữ lại làm reference tham khảo cho Phase 3 (L402) vì có demo `fiber-l402` dùng đúng thư viện này.

[2026-07-01] **Phase 2 real-time listener — verified**: Xác nhận FNN có RPC module `pubsub` (method `subscribe_store_changes`/`unsubscribe_store_changes`, notification `store_changes`), tồn tại từ bản stable v0.8.1 (không phải chỉ nhánh develop), có document chính thức tại `fiber.world/docs/api-reference#websocket-subscriptions`. Node bắn `StoreChange::PutCkbInvoiceStatus { payment_hash, invoice_status }` đúng lúc invoice đổi trạng thái — Lý do quyết định dùng cho Phase 2: đây là cách duy nhất tránh polling định kỳ, khớp với tốc độ thanh toán tức thời của Fiber Network. Ràng buộc đã biết: (a) doc chính thức ghi rõ mục đích thiết kế là cho Cross-Chain Hub, không phải general client — coi là "off-label usage", vẫn giữ poll fallback tần suất thấp (30-60s); (b) `@ckb-ccc/fiber` không hỗ trợ subscription (đã verify qua source npm thật) — cần viết 1 WebSocket JSON-RPC client riêng cho phần này; (c) nếu bật Biscuit auth cần thêm quyền `read("cch")`, nhưng vì `fiber-node` chỉ bind nội bộ trong docker network (không public IP) nên dự kiến không bật Biscuit auth, ràng buộc này không phát sinh trong setup mặc định.

---

## Business Logic

<!-- Thêm vào đây khi có decision được chốt -->

---

## Scope

[2026-07-01] **Phased rollout của tính năng nâng cao**: Websocket/JSON-RPC real-time invoice listener (Phase 2) và L402 subscription middleware (Phase 3, optional stretch) đều nằm trong scope nộp bài, nhưng triển khai theo phase riêng biệt sau khi Phase 1 (docker-compose core: invoice + webhook + dashboard cơ bản) chạy ổn định — Lý do: Giảm rủi ro thời gian trong 15 ngày hackathon; ưu tiên có 1 core flow chạy chắc trước khi thêm tính năng nâng cao.

[2026-07-01] **Đối chiếu với thể lệ hackathon chính thức** (campaign page, user paste nguyên văn): Category đã chọn "Merchant, Liquidity, LSP, and Multi-Asset Infrastructure" — khớp với ví dụ "Merchant checkout SDKs, payment processor prototypes, hosted payment pages, or payment status webhooks" trong đề bài. Phát sinh 3 quyết định bổ sung:
  1. **Naming**: Đổi mô tả từ "LSP framework" sang "merchant payment gateway framework" trong `INDEX.md`/`CLAUDE.md` — Lý do: FiberGate không cung cấp dịch vụ liquidity/mở channel hộ bên thứ ba (đúng nghĩa LSP), tránh overclaim khiến giám khảo hiểu sai scope thực tế.
  2. **Demo bắt buộc**: Thêm "Demo merchant checkout flow" + "1 instance demo public/hosted" vào IN SCOPE Phase 1 (`project-vision.md`) — Lý do: Deliverables hackathon yêu cầu bắt buộc "demo link... plus a hosted demo"; kiến trúc self-hosted-only (không có URL cố định) không tự động thoả điều kiện này nếu không tự deploy 1 bản demo.
  3. **License**: Chọn **MIT** cho toàn bộ repo (mặc định phổ biến cho hackathon open-source, đơn giản, permissive) — Lý do: Deliverables yêu cầu "repository link with fully open-sourced code", cần 1 license rõ ràng. Có thể đổi sau nếu cần, chưa tạo file `LICENSE` trong phiên này.

---

## Open Questions

> Những vấn đề chưa được chốt. Xóa dòng khi đã có quyết định
> và chuyển lên section tương ứng ở trên.

<!-- Thêm vào đây khi phát sinh câu hỏi cần chốt -->