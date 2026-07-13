# Contributing

## Setup

See [docs/maintainers/getting-started.md](docs/maintainers/getting-started.md) for
local dev setup, commands, and running the full stack from source.

## Before you change something non-trivial

Architecture, database schema, API response format, new dependencies, and anything
touching security/auth/signing/hashing are **not** decided unilaterally in this
project — see `CLAUDE.md`'s "Nguyên tắc làm việc với AI Agent" section. If you're
unsure whether your change falls into one of those buckets, open an issue or ask in
the PR description before writing code, rather than after.

If you do change the database schema, update
`.context/data-dictionary/database-schema.md` in the same PR — `apps/web/lib/db/schema.ts`
and that file must never drift apart.

## Commits

This repo doesn't enforce Conventional Commits via tooling, but PR/commit titles
consistently follow `type(scope): summary` — `feat`, `fix`, `docs`, `chore`,
`refactor`, `build` — e.g. `fix(create-fibergate): preserve the original decrypt
error instead of discarding it`. Match that style; it makes `git log`/release notes
readable.

## Before opening a PR

```bash
pnpm lint
pnpm --filter web typecheck
pnpm --filter web test:unit
pnpm --filter sdk test:unit
pnpm build
```

If your change touches an `/api/v1/*` route or its underlying service, also run the
HTTP integration suite against a live stack:

```bash
pnpm --filter web test:integration
```

## Code layout conventions

- `route.ts` handlers do auth, request parsing/validation, and response shaping only
  — business logic (DB queries, Fiber RPC calls, domain rules) belongs in
  `lib/services/*.ts`. See `CLAUDE.md`'s "Service layer pattern".
- Tests are two-layered to match: `lib/services/*.test.ts` mocks `@/lib/db` +
  `@/lib/fiber/client`; `route.test.ts` mocks `@/lib/services/*`.
- TypeScript strict mode throughout — no `any`. Explicit error handling — no empty
  `try/catch`.

## Recording decisions

A decision made during your PR's discussion (a human confirming one approach over
another) should be appended to `.context/processes/decisions-log.md` in the same PR
— see [docs/maintainers/release-process.md](docs/maintainers/release-process.md)'s
"Recording architecture/business decisions" for the format and what does/doesn't
belong there.

## Code of Conduct

This project follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
