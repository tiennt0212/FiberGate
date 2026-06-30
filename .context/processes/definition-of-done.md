---
type: process
module: ai-session-dod
version: 1.2
last_updated: 2026-06-30
tags: [dod, ai-agent, claude-code, session]
---

# Definition of Done — AI Coding Session

> Áp dụng cho mỗi phiên làm việc với Claude Code.
> Trước khi kết thúc phiên, Claude Code tự kiểm tra
> và báo cáo theo format dưới đây.

---

## Format báo cáo cuối phiên

```
### Session Summary — [tên feature/task]

**Đã làm:**
- [item 1]

**Còn dở / chưa làm:**
- [item nếu có, lý do]

**Câu hỏi cần human trả lời trước phiên tiếp theo:**
- [câu hỏi cụ thể, rõ ràng]

**Decisions mới được chốt trong phiên này:**
- [ghi ngắn gọn — Claude Code cập nhật vào decisions-log.md]

**Context files đã cập nhật:**
- [tên file hoặc "không có"]
```

---

## Checklist tự verify

### Code integrity
- [ ] TypeScript không có lỗi (`tsc --noEmit` pass)
- [ ] Không có `console.log` debug còn sót
- [ ] Không hardcode giá trị nên là env variable
- [ ] Mọi TODO mới thêm vào đều có ghi chú lý do

### Context consistency

Nếu phiên này thay đổi bất kỳ điều gì dưới đây, file context tương ứng
**phải được cập nhật trong cùng phiên**, không để sang phiên sau:

| Thay đổi gì | Cập nhật file nào |
|---|---|
| Thêm/sửa bảng DB | `data-dictionary/database-schema.md` |
| Thêm/sửa API endpoint | `api/rest-api-spec.md` |
| Thay đổi business logic | `business-rules/payment-rules.md` |
| Thay đổi kiến trúc | `architecture/system-design.md` |
| Decision mới được human chốt | `processes/decisions-log.md` |
