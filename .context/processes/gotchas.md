---
type: process
module: infra-gotchas
version: 1.0
last_updated: 2026-07-14
tags: [gotchas, infra, fiber, docker, ai-agent]
---

# Infra/protocol gotchas đã tốn công tìm ra

> Mỗi mục dưới đây từng bị hiểu sai lúc đầu và chỉ được phát hiện qua verify thực
> nghiệm (chạy thật, không chỉ đọc code/docs). Chi tiết đầy đủ + cách verify:
> `.context/processes/decisions-log.md`. Đừng lặp lại các lỗi này.

---

- **`0.0.0.0` bị `fnn` coi là "public" dù chỉ bind trong Docker network riêng** (kể
  cả khi host không route ra ngoài thật) — không bind RPC ra `0.0.0.0` để "cho dễ
  kết nối" giữa container; dùng static private IP trên network riêng thay vào đó.

- **`.env` corrupt ký tự `$` theo 2 cách khác nhau** (Docker Compose interpolation
  vs `dotenv-expand`) — giá trị chứa `$` (vd bcrypt hash) phải base64-encode trước
  khi ghi vào `.env`; không có cách escape nào thoả cả 2 reader cùng lúc.

- **`ckb-cli account export --extended-privkey-path` xuất 2 dòng (key + chain
  code), `fnn` chỉ nhận đúng 1 dòng raw hex** — lỗi `aead::Error` khi decrypt trông
  giống sai password nhưng thực ra là sai format.

- **`pubsub` không nằm trong `enabled_modules` mặc định của FNN** — phải khai báo
  tường minh trong `docker/fiber-node/config.yml`; set field này THAY THẾ default
  hoàn toàn, không cộng dồn.

- **`subscribe_store_changes`'s subscription id trả về là JSON number, không phải
  string** — code chỉ check `typeof result === "string"` sẽ không bao giờ resolve
  khi chạy với node thật, dù unit test tự bịa response shape vẫn pass.

- **RUSD/UDT resolution cache có thể stale-forever hoặc bị request-storm race nếu
  cache theo value thay vì theo in-flight promise** — cache "chưa configured" mãi
  mãi nếu không invalidate đúng cả khi RPC fail lẫn khi "vẫn chưa thấy".

- **Invoice `expired` không reverse được ngay cả khi payment thật settle sau đó** —
  Fiber network không enforce `expiry` ở tầng payee; đây là business-rule chưa chốt
  hướng fix, xem issue #51, không tự ý đổi behavior.
