# Fiber Gateway — Claude Code Instructions

## Đây là project gì?

Fiber Gateway là LSP (Lightning Service Provider) prototype cho Fiber Network hackathon.
Xem `.context/INDEX.md` để hiểu toàn bộ project trước khi làm bất kỳ task nào.

## Context files quan trọng (đọc theo thứ tự này)

1. `.context/INDEX.md` — Overview và quy ước
2. `.context/glossary/fiber-terms.md` — Thuật ngữ (quan trọng để không hallucinate)
3. `.context/architecture/system-design.md` — Kiến trúc và data flow
4. `.context/data-dictionary/database-schema.md` — Schema DB
5. `.context/api/rest-api-spec.md` — API spec
6. `.context/business-rules/payment-rules.md` — Logic nghiệp vụ

## Rules quan trọng

- **KHÔNG** tự thêm dependencies mà không hỏi
- **KHÔNG** hardcode bất kỳ secret hay URL nào
- **KHÔNG** tự sửa database schema mà không update `.context/data-dictionary/database-schema.md`
- Tất cả Supabase types phải được generate từ schema thực tế (`supabase gen types`)
- Mọi API route phải validate authentication trước khi làm bất cứ điều gì khác
- Error handling phải explicit, không dùng `try/catch` rỗng

## Monorepo commands

```bash
pnpm install          # install tất cả packages
pnpm dev              # chạy apps/web dev server
pnpm build            # build tất cả
pnpm --filter sdk build   # build chỉ sdk package
```

## Khi implement một feature mới

1. Đọc user story liên quan trong `.context/user-stories/`
2. Đọc business rules liên quan trong `.context/business-rules/`
3. Implement theo API spec trong `.context/api/rest-api-spec.md`
4. Update context file nếu có thay đổi design