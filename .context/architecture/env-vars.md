---
type: reference
module: env-vars
version: 1.0
last_updated: 2026-07-14
tags: [env, config, secrets, ai-agent]
---

# Environment Variables — canonical reference

> Nguồn duy nhất liệt kê **toàn bộ** env var trong repo, qua cả 4 file
> `.env.example`. Khi thêm/đổi 1 biến: sửa đúng `.env.example` liên quan **và**
> bảng tương ứng ở đây trong cùng lần sửa — 2 nơi không tự đồng bộ.
>
> Bản dễ đọc hơn cho merchant/contributor (không cần biết code): xem
> `docs/common/environment-variables.md`.

---

## 1. Root `.env.example` → `.env` (docker-compose.yml — build-from-source, contributor/dev path)

| Var | Bắt buộc | Giá trị mặc định/cố định | Mô tả |
|---|---|---|---|
| `POSTGRES_USER` | Configurable | `fibergate` | Đọc bởi cả `postgres` service lẫn `fibergate-core` — 3 biến `POSTGRES_*` này là single source of truth cho DB credentials. |
| `POSTGRES_DB` | Configurable | `fibergate` | " |
| `POSTGRES_PASSWORD` | **Required** | (không có default an toàn) | " |
| `FIBER_SECRET_KEY_PASSWORD` | **Required** | — | Mật khẩu mở khoá CKB signing key file tại `docker/fiber-node/ckb/key`. Chỉ `fiber-node` đọc, không phải app-level var, nhưng vẫn nằm trong `.env.example` để `cp .env.example .env` surface đủ giá trị required 1 lần. |
| `DOMAIN` | **Required** | (không có default dùng được) | Domain public cho nginx/certbot — cần DNS trỏ vào host, port 80/443/8228 mở ra internet. |
| `CERTBOT_EMAIL` | Optional | — | Email nhận thông báo hết hạn cert Let's Encrypt. Không được đọc lúc `docker compose up -d` (self-signed cert tạm luôn được sinh) — chỉ cần khi chạy `certbot certonly` thật. |
| `ADMIN_PASSWORD_HASH_B64` | **Required** | — | Base64-encoded bcrypt hash cho dashboard single-admin login — **không phải** raw `$2y$10$...` hash (xem gotcha `.env` corrupt `$`). |
| `DASHBOARD_SESSION_SECRET` | **Required** | — | Ký session cookie (httpOnly JWT) cho `app/(dashboard)/**`. Cố ý tách biệt khỏi `FIBERGATE_INTERNAL_SECRET` (BR-SEC-004). |
| `FIBERGATE_INTERNAL_SECRET` | **Required** | — | Shared secret duy nhất cho `/api/v1/*` — storefront app dùng làm Bearer token. |
| `FIBER_NODE_URL` | Fixed value | `http://fiber-node:8227` | DNS name nội bộ docker-compose, chỉ resolve được trong network đó. Đổi giá trị này thì phải đổi luôn `docker/fiber-node/config.yml`'s `rpc.listening_addr`. |
| `FIBER_NODE_RPC_AUTH_TOKEN` | Optional | — | Biscuit token — không cần vì `fiber-node` không có public IP. **Lưu ý**: `@ckb-ccc/fiber` bản đang pin chưa có cơ chế gắn token này vào request thật kể cả khi set (xem `decisions-log.md` 2026-07-03). |
| `WEBHOOK_SECRET_ENCRYPTION_KEY` | **Required** | 64-char hex, `create-fibergate`/`pnpm generate:env` tự sinh | AES-256-GCM key mã hoá `webhook_endpoints.secret` at rest — không phải signing key (signing key là secret riêng của từng endpoint, BR-SEC-003). |
| `CRON_SECRET` | Optional | — | Bảo vệ `/api/cron/poll-invoices` (manual trigger endpoint). |
| `FIBER_PAYER_SECRET_KEY_PASSWORD` | Required chỉ khi dùng `fiber-node-payer` | — | Mật khẩu key riêng cho `fiber-node-payer` (local-testing only, profile `payer`, không start bằng `docker compose up -d` trần) — key khác hẳn `FIBER_SECRET_KEY_PASSWORD`. |

## 2. `.env.release.example` → `.env` (docker-compose.release.yml — merchant published-image path)

Giống hệt bảng 1, **trừ** `FIBER_PAYER_SECRET_KEY_PASSWORD` (fiber-node-payer không có trong release bundle), **cộng thêm**:

| Var | Bắt buộc | Giá trị mặc định/cố định | Mô tả |
|---|---|---|---|
| `GHCR_NAMESPACE` | **Required** | — | GitHub org/user đã publish image `fibergate-core` (`ghcr.io/<GHCR_NAMESPACE>/fibergate-core`). |
| `FIBERGATE_CORE_TAG` | Optional | `latest` | Pin về 1 build cụ thể (vd `sha-a1b2c3d`) thay vì canary mới nhất. |

## 3. `apps/web/.env.example` → `apps/web/.env.local` (local dev ngoài Docker)

Chỉ override đúng 3 biến khác giá trị so với root `.env` khi chạy `pnpm dev` (không qua Docker) — mọi biến khác lấy từ root `.env` qua `dotenv-cli` (`dotenv -e .env.local -e ../../.env -- next dev`, file liệt kê trước thắng).

| Var | Bắt buộc | Giá trị mặc định/cố định | Mô tả |
|---|---|---|---|
| `POSTGRES_HOST` | Configurable | `localhost` | Root `.env` không có field này — trong docker-compose là `postgres` (DNS nội bộ). Chỉ hoạt động vì `docker-compose.yml`'s `postgres` service publish port loopback-only (`127.0.0.1:5432`). |
| `POSTGRES_PORT` | Configurable | `5432` | — |
| `FIBER_NODE_URL` | Fixed value (override) | `http://localhost:8227` | Root `.env`'s giá trị (`http://fiber-node:8227`) không resolve được ngoài Docker network — cần `fiber-node` chạy qua `docker compose up -d fiber-node` (RPC publish loopback-only). |

## 4. `apps/demo-storefront/.env.example` → `.env.local` (app tách biệt hoàn toàn, reference merchant)

Không đọc `apps/web`'s env vars hay root `.env` — hoàn toàn độc lập, giống 1 merchant thứ ba thật. Cùng file cũng được `docker-compose.demo.yml` đọc qua `env_file:`.

| Var | Bắt buộc | Giá trị mặc định/cố định | Mô tả |
|---|---|---|---|
| `FIBERGATE_BASE_URL` | **Required** | `http://localhost:3000` | Root URL (không có `/api/v1` suffix) của deployment FiberGate. Bị ignore khi chạy qua Docker Compose overlay (hardcode `http://fibergate-core:3000`). |
| `FIBERGATE_INTERNAL_SECRET` | **Required** | — | Phải khớp chính xác với `fibergate-core`'s `FIBERGATE_INTERNAL_SECRET` (mục 1) — dùng làm Bearer token gọi `/api/v1/invoices`. |
| `DEMO_WEBHOOK_SECRET` | **Required** | — | Phải khớp secret đã đăng ký khi tạo webhook endpoint trên FiberGate deployment — verify header `X-Fiber-Signature`. |

---

## Lưu ý dùng chung

- 2 biến tên giống nhau nhưng khác file/mục đích: `FIBER_NODE_URL` (bảng 1 vs bảng 3 — giá trị docker DNS vs localhost) và `FIBERGATE_INTERNAL_SECRET` (bảng 1 vs bảng 4 — 2 phía của cùng 1 shared secret, phải khớp giá trị).
- Cách generate từng secret: merchant path → `create-fibergate` tự generate hộ (`docs/merchants/quickstart.md`); contributor/from-source path → `pnpm generate:env` (`docs/maintainers/getting-started.md`'s "Generating a real `.env`"). **Không** phải "README.md's Generating secrets" — section đó không tồn tại, dù 4 file `.env.example` đều lỡ trỏ về đó.
- Gotcha liên quan tới `.env`/Docker Compose forwarding: xem `.context/processes/gotchas.md`.
