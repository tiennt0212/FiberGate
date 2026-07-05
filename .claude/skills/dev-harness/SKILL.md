---
name: dev-harness
description: Autonomous OODA-loop harness for building and fixing FiberGate features (Next.js API routes under app/api/v1/, dashboard pages, Fiber RPC integration in lib/fiber/, Drizzle DB schema, SDK package). Spawns isolated sub-agents for Planner → Implementer → Checker → Eval → PR, sharing state via disk. Use when the user says "build", "add a feature", "fix", "add an endpoint", "add a page", or gives any implementation task for the FiberGate app. Do NOT trigger for pure Q&A, code review, or read-only exploration.
---

# dev-harness — FiberGate Feature Development Harness

This skill runs an autonomous OODA loop, spawning isolated sub-agents for each phase
and sharing state through files on disk. The loop continues until all checks pass
or `max_iterations` is reached.

**Why sub-agents?** Each phase needs a clean context window. The Implementer must not
see the Planner's reasoning noise; the Checker must not inherit partial edits as
assumptions. Context isolation prevents cross-phase contamination.

**Why harness-state.json?** State on disk is inspectable, resumable, and survives
context compaction. Sub-agents get deterministic, structured input — not a reconstructed
summary of prior turns.

**Hard stop overrides `--auto`.** `CLAUDE.md` lists categories the project owner must
decide personally: DB schema changes, API response-format changes, new dependencies,
deleting existing code/files, any security/auth/signing/hashing logic, and architecture
choices with multiple viable approaches. If the Planner's brief flags any of these in
`needs_human_decision`, the orchestrator MUST checkpoint and wait for an explicit answer
before Step 2 — even when `auto = true`. `--auto` only suppresses routine phase-to-phase
checkpoints, never these.

**Skill layout:**
```
dev-harness/
├── SKILL.md               ← orchestrator (this file)
├── agents/                ← prompt templates; orchestrator reads, substitutes vars, spawns
│   ├── planner.md         ← use {run_dir} and {iteration} as placeholders
│   ├── implementer.md
│   ├── checker.md
│   ├── eval.md
│   └── pr.md
└── references/
    └── context-logging.md ← read by sub-agents to self-report context used
```

---

## Arguments

`$ARGUMENTS` — required. Syntax: `[--auto] <task description>`

- `--auto` (optional): suppresses routine phase-to-phase checkpoints; runs phases
  back-to-back. Does NOT suppress the `needs_human_decision` checkpoint (see below).
- `<task description>`: what to build or fix. Examples: "add a GET /api/v1/node/info
  route", "add a webhook retry counter to the dashboard", "fix the invoice status
  poller in lib/fiber/".

If no task is provided, ask once before proceeding.

---

## Step 0 — Parse arguments and initialize state

Parse `$ARGUMENTS`: if the first token is `--auto`, set `auto = true` and strip it.
The remainder is the task. If task is empty, ask: "What should the harness build or fix?"

**Derive a timestamp:**
```bash
date -Iseconds | sed 's/://g' | sed 's/+.*$//'
```
This produces e.g. `20260502T192516`. Use it as `<timestamp>`.

**Create run directory:** `.claude/harness/<timestamp>/`. Store as `<run-dir>`.

Write `<run-dir>/harness-state.json`:

```json
{
  "task": "<task from arguments>",
  "phase": "planner",
  "iteration": 0,
  "max_iterations": 5,
  "auto": false,
  "run_dir": "<run-dir>",
  "feature_type": "",
  "target_files": [],
  "needs_human_decision": [],
  "artifacts": [],
  "errors": [],
  "context_log": [],
  "eval_scores": {},
  "pr_description": "",
  "started_at": "<ISO8601 from: date -Iseconds>",
  "updated_at": "<ISO8601 from: date -Iseconds>"
}
```

`feature_type` values: `"api-route"`, `"dashboard-page"`, `"ui-component"`, `"db-schema"`,
`"fiber-lib"`, `"sdk"`, `"mixed"`. There is no `"contract"` type — FiberGate never writes
CKB Scripts (see CLAUDE.md).

`needs_human_decision` entries: `{ "category": "db-schema | api-format | new-dependency | deletion | security-auth | architecture-choice", "detail": "<what's ambiguous and why>" }`

Error object shape:
```json
{ "iteration": 0, "type": "build | lint | test | structural | quality", "severity": "ERROR | WARN", "file": "", "message": "" }
```
`test` = a failing unit test (Checker's Check 3). `quality` = a `/code-review` finding
surfaced by Checker's Check 5 — `ERROR` for a correctness bug (reopens the loop), `WARN`
for a reuse/simplification/efficiency finding (recorded only, never blocks).

Proceed to Step 1.

---

## Step 1 — Planner phase

Read `agents/planner.md`. Replace every `{run_dir}` with `<run-dir>` and `{iteration}`
with `0`. Spawn a sub-agent using the Agent tool with `subagent_type: "Plan"` (the
built-in software-architect agent — its job already matches this phase: read context,
produce a step-by-step brief, identify critical files, weigh architectural trade-offs —
use it instead of the generic default) and the resulting text as the prompt.

After the agent returns, confirm `feature_type` and `target_files` are populated in
state and that `<run-dir>/harness-brief.md` exists.

**Hard-stop check (always, regardless of `auto`):** read `needs_human_decision` from
state. If non-empty, print each entry's `category` and `detail`, ask the user to
resolve each one explicitly, and wait for a reply before proceeding to Step 2. Do not
let the Implementer guess at DB schema shape, API response format, which dependency to
add, what to delete, or how to implement auth/signing/hashing — these are the user's
call per CLAUDE.md. Once resolved, append the resolution to `<run-dir>/harness-brief.md`
under a "Resolved decisions" section before continuing.

If `needs_human_decision` is empty and `auto = false`: show "Planner complete. Review
`<run-dir>/harness-brief.md` then reply 'continue'." Wait.

---

## Step 2 — Implementer phase (loop entry)

Read state. Note current `iteration` value (`N`).

Read `agents/implementer.md`. Replace `{run_dir}` → `<run-dir>` and `{iteration}` → `N`.
Spawn a sub-agent with the resulting text as the prompt.

If `auto = false`: show "Implementer complete (iteration `N`). Reply 'continue' to run Checker." Wait.

Proceed to Step 3.

---

## Step 3 — Checker phase

Read `agents/checker.md`. Replace `{run_dir}` → `<run-dir>` and `{iteration}` → `N`.
Spawn a sub-agent with the resulting text as the prompt.

After it returns, proceed to Step 4 (orchestrator reads state directly).

---

## Step 4 — Decision gate (orchestrator only — do not spawn a sub-agent)

Read `<run-dir>/harness-state.json`. Apply this logic:

```
current_errors = [e for e in errors if e.iteration == N and e.severity == "ERROR"]

if len(current_errors) == 0:
    set phase = "eval" → write state → proceed to Step 5

elif N >= max_iterations - 1:
    set phase = "done" → write state
    print "Harness stopped: max iterations reached."
    print remaining ERRORs
    STOP

else:
    increment iteration → set phase = "implementer" → write state
    if auto == false: print error count, ask user to reply 'continue'
    jump to Step 2
```

WARNs do not trigger re-implementation. They are recorded and surfaced in the PR.

---

## Step 5 — Eval phase

Read `agents/eval.md`. Replace `{run_dir}` → `<run-dir>` and `{iteration}` → `N`.
Spawn a sub-agent with the resulting text as the prompt.

If `auto = false`: show "Eval complete. Review `eval_scores` in state. Reply 'continue'." Wait.

---

## Step 6 — PR Draft phase

Read `agents/pr.md`. Replace `{run_dir}` → `<run-dir>` and `{iteration}` → `N`.
Spawn a sub-agent with the resulting text as the prompt.

---

## Step 7 — Completion

Read `<run-dir>/harness-state.json`. Print:

```
Harness complete after <iteration+1> iteration(s).
Stage these files for commit:
<all artifact file paths, one per line>

--- PR DESCRIPTION ---
<pr_description field>

--- CONTEXT LOG ---
<for each entry in context_log:>
[<phase>] iter=<N>  files=<count>  skills=<names or "none">  mcp=<tool@server or "none">
```

The run directory `.claude/harness/<timestamp>/` is ephemeral — delete after PR merges.

---

## Error reference

| Situation | Orchestrator action |
|---|---|
| Planner returns without `harness-brief.md` | Stop. Do not proceed with missing brief. |
| Checker returns without updating `errors` | Treat as 0 errors, proceed to Eval. |
| PR agent returns with "PR BLOCKED" | Print blocker list. Stop. |
| Max iterations reached | Print remaining errors. Stop. |
| `harness-state.json` missing at phase entry | Stop and ask user to re-run: `/dev-harness [--auto] <task>` |
