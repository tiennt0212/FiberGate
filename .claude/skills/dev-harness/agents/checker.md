You are the Checker in a dev-harness run (iteration {iteration}) for FiberGate. Your job
is to validate the implementation and report structured errors. You have access to Bash
and the Skill tool.

Read first:
1. `{run_dir}/harness-state.json` — read `feature_type`, `target_files`
2. `{run_dir}/harness-brief.md` — acceptance criteria

Run these checks in order:

**Check 1 — TypeScript** (always):
```bash
pnpm --filter web typecheck 2>&1
```
Deliberately `typecheck` (`tsc --noEmit`, ~3s), not the full `pnpm build` (~35s, and it
outright fails with an unrelated "Missing required env var: POSTGRES_USER"-style error on
any checkout without a real `.env` — a fresh clone won't have one). `tsc --noEmit` is also
all `.context/processes/definition-of-done.md`'s "Code integrity" checklist actually
requires. Parse errors → `{ "type": "build", "severity": "ERROR", ... }`. A full
production `next build` still runs once, later, in the PR phase (see `agents/pr.md`) —
not on every one of up to `max_iterations` loop passes.

**Check 2 — Lint** (always):
```bash
pnpm lint 2>&1
```
Errors → `severity: "ERROR"`, warnings → `severity: "WARN"`. Each → `{ "type": "lint", ... }`.

**Check 3 — Unit tests** (always, if a test script exists for the touched package):
```bash
pnpm --filter web test:unit 2>&1
```
Deliberately `test:unit`, not `pnpm test`/`test:integration` — integration tests need a
live Postgres/fiber-node this phase doesn't provision, and would fail for reasons
unrelated to the change. If `target_files` only touches `packages/sdk` and it has no
`test:unit` script, skip this check rather than inventing one. Each failing test →
`{ "type": "test", "severity": "ERROR", ... }`. Do not write new tests here — that's
the Implementer's job if the brief calls for it; this check only runs what exists.

**Check 4 — Structural** (based on `feature_type`):

If `api-route` or `mixed`:
- Read the route file. If the Bearer-token constant-time comparison against
  `FIBERGATE_INTERNAL_SECRET` is not the first thing the handler does:
  `{ "type": "structural", "severity": "ERROR", "message": "<route> does not validate auth before other logic" }`
- If the handler's success/error shape doesn't match `{ data, error }`:
  `{ "type": "structural", "severity": "ERROR", "message": "<route> response format does not match { data, error }" }`
- Grep the route file for direct Fiber RPC calls (anything bypassing
  `apps/web/lib/fiber/client.ts`):
  `{ "type": "structural", "severity": "ERROR", "message": "<route> calls Fiber RPC directly instead of via lib/fiber/client.ts" }`

If `db-schema` or `mixed`:
- If `apps/web/lib/db/schema.ts` (or the touched schema file) changed but
  `.context/data-dictionary/database-schema.md` was not updated in this run's artifacts:
  `{ "type": "structural", "severity": "ERROR", "message": "database-schema.md not updated to match schema change" }`

If `dashboard-page` or `mixed`, and `target_files` touches `apps/web/lib/auth/**` or
`apps/web/middleware.ts` (session/cookie/auth-adjacent code — treat carefully per
CLAUDE.md's "security, auth, signing, hashing" hard-stop category):
- Grep the cookie-setting code for `httpOnly: true` (or an equivalent options object
  applied to every `.cookies.set(...)` call). Missing on any call site →
  `{ "type": "structural", "severity": "ERROR", "message": "<file> sets a session cookie without httpOnly (BR-SEC-004)" }`
- Grep for a secret/signing-key/password-hash used as a literal string instead of read
  via `requireEnv(...)`:
  `{ "type": "structural", "severity": "ERROR", "message": "<file> hardcodes a secret instead of reading it via requireEnv" }`
- If `apps/web/middleware.ts` changed, confirm its `config.matcher` is an inline literal
  array at the export site, not an imported identifier. Next.js only statically extracts
  a literal at that exact declaration — an imported matcher is silently ignored, which
  either disables the guard entirely or runs middleware unscoped on every route. Not a
  literal array →
  `{ "type": "structural", "severity": "ERROR", "message": "middleware.ts's config.matcher must be an inline literal, not imported — Next.js silently ignores non-literal matchers" }`

If `sdk`:
```bash
pnpm --filter sdk build 2>&1
```
Parse errors the same way as Check 1.

There is no `contract` feature type and no CKB Script build step — FiberGate does not
write CKB Scripts (see CLAUDE.md).

**Check 5 — Quality review** (only if Checks 1–4 found zero ERRORs this iteration):

Skip this check entirely if any ERROR was found above — there's no value reviewing code
that doesn't build/lint/test/structurally-pass yet; it comes back next iteration once
that's clean.

Otherwise, invoke the `code-review` skill (Skill tool, `skill: "code-review"`, effort
`low`) against the diff this iteration produced. This is what catches the class of
finding grep-based structural rules can't — reuse, simplification, efficiency,
altitude cleanups, and correctness bugs outside the specific invariants Check 4 knows
to look for. Map its findings into `errors`:
- A correctness bug → `{ "type": "quality", "severity": "ERROR", ... }` — reopens the
  loop, Implementer gets another iteration to fix it.
- A reuse/simplification/efficiency finding → `{ "type": "quality", "severity": "WARN", ... }`
  — recorded only, never blocks, surfaced later in the PR's "Open warnings".

Keep this at effort `low` (or `medium` at most) — it runs on every iteration up to
`max_iterations` times, so cost/speed matter. A deeper pass (`high`/`ultra`) is the
human's call to trigger explicitly later, not a per-iteration default.

Update `{run_dir}/harness-state.json`:
- Append all findings to `errors` (do NOT replace prior entries)
- Set `phase: "decision"`
- Update `updated_at`

Print: `"Checker iteration {iteration}: <X> ERRORs, <Y> WARNs"`

Follow the context-logging protocol in `.claude/skills/dev-harness/references/context-logging.md`
using `"phase": "checker"` and `"iteration": {iteration}`. Log `"code-review"` under
`skills_used` if Check 5 ran.
