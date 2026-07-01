# -exp Skill Directory Layout

Every `-exp` skill follows this 3-layer structure:

```
{library}-exp/
  SKILL.md                    ← skill metadata, description, quick reference
  best-practices/
    _sections.md              ← domain-specific sections (defined per skill)
    {prefix}-{rule-name}.md   ← one file per principle
  reminders/
    _sections.md              ← copy from exp-blueprint/sections/reminders.md
    {reminder-name}.md        ← one file per reminder
  collab/
    ecosystem.md              ← collab/trade-off analysis
```

---

## Layer Definitions

### `best-practices/` — Principles

**Purpose:** Transferable principles with rationale. Explains WHY, includes ❌/✅ code examples.

**When content belongs here:**
- Has a clear principle that applies across projects
- Benefits from a "why this matters" explanation
- Can be illustrated with a before/after code example
- Has a meaningful impact level (HIGH / MEDIUM / LOW-MEDIUM)

**On examples:** Use generic, hypothetical identifiers — `UserRole`, `Status`, `PageLayout` — never names lifted from the codebase that prompted the rule. The test: could a developer on a completely different project read this and recognize the pattern?

**File naming:** prefix matches the section category (e.g. `state-`, `routing-`, `constants-`)

**`_sections.md`:** domain-specific, defined in each skill. Groups rules into categories.

**Template:** `exp-blueprint/templates/best-practices-rule.md`

---

### `reminders/` — Quick Lookup

**Purpose:** Short-form lookup entries. No extended WHY — just what to remember.

**When content belongs here:**
- Pure API lookup (old prop → new prop)
- Gotcha or silent failure (no principle needed, just awareness)
- Project-specific convention or file location
- One-liner fix that doesn't need a full explanation

**Format:** table (old→new) or short bullet list. No ❌/✅ code blocks.

**`_sections.md`:** universal — copy from `exp-blueprint/sections/reminders.md`. Do not customize per skill.

**Template:** `exp-blueprint/templates/reminder.md`

---

### `collab/` — Ecosystem & Trade-offs

**Purpose:** Living knowledge about library compatibility, integration patterns, and tech stack choices. Has a shorter shelf life than `best-practices/` — includes freshness metadata and re-verify instructions.

**When content belongs here:**
- Which libraries work well (or poorly) together with this one
- Trade-off comparison vs. alternatives
- Integration-specific setup notes
- Tech stack decision guidance

**Freshness mechanism:** every `collab/` file must include:
- `verified-against:` and `last-verified:` in frontmatter
- `## When to Re-verify` section with checkboxes and search queries
- `## Propose Updates` section instructing the agent to flag new discoveries

**Template:** `exp-blueprint/templates/collab-ecosystem.md`

---

## Naming Convention

| Skill type | Name pattern | Example |
|---|---|---|
| Library/tool | `{library}-exp` | `antd-exp`, `tailwind-v4-exp` |
| Framework | `{framework}-exp` | `storybook-exp`, `frontend-exp` |
| Project-specific | `{project}-exp` | `ckbuilder-exp` |

Project-specific skills hold reminders only — no `collab/ecosystem.md` required unless the project has meaningful ecosystem decisions to document.
