---
type: process
module: ai-session-dod
version: 1.2
last_updated: 2026-06-30
tags: [dod, ai-agent, claude-code, session]
---

# Definition of Done — AI Coding Session

> Applies to every Claude Code working session.
> Before ending a session, Claude Code should self-check
> and report using the format below.

---

## End-of-session report format

```
### Session Summary — [feature/task name]

**Done:**
- [item 1]

**Incomplete / not done:**
- [item if any, reason]

**Questions for the human before the next session:**
- [specific, clear question]

**New decisions settled during this session:**
- [brief note — Claude Code updates decisions-log.md]

**Context files updated:**
- [file name or "none"]
```

---

## Self-verify checklist

### Code integrity
- [ ] TypeScript has no errors (`tsc --noEmit` passes)
- [ ] No leftover debug `console.log` statements
- [ ] No hardcoded values that should be an env variable
- [ ] Every new TODO has a note explaining why

### Context consistency

If this session changed any of the following, the corresponding context file
**must be updated in the same session** — don't defer it to a later session:

| What changed | Which file to update |
|---|---|
| Added/changed a DB table | `data-dictionary/database-schema.md` |
| Added/changed an API endpoint | `api/rest-api-spec.md` |
| Changed business logic | `business-rules/payment-rules.md` |
| Changed architecture | `architecture/system-design.md` |
| New decision settled by a human | `processes/decisions-log.md` |
