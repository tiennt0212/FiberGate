---
name: exp-blueprint
description: Meta-skill that defines the directory structure and template formats for all -exp skills. ALWAYS consult this skill when creating a new -exp skill, adding a new content layer (best-practices/reminders/collab), writing a new rule or reminder entry, or when unsure about the correct template format for any skill in this library.
license: MIT
metadata:
  author: ckbuilder-team
  version: "1.0.0"
---

# exp-blueprint

Single source of truth for the structure and templates of all `-exp` skills. All template formats and directory layout conventions are defined here — individual skills do not duplicate them.

## What's Here

```
exp-blueprint/
  structure/
    directory-layout.md     ← 3-layer directory convention for -exp skills
  templates/
    best-practices-rule.md  ← template for new rules in best-practices/
    reminder.md             ← template for new entries in reminders/
    collab-ecosystem.md     ← template for collab/ecosystem files
  sections/
    reminders.md            ← canonical _sections.md for reminders/ (shared by all skills)
```

## When to Use

- **Creating a new `-exp` skill** → read `structure/directory-layout.md` first
- **Writing a new best-practice rule** → copy from `templates/best-practices-rule.md`
- **Writing a new reminder** → copy from `templates/reminder.md`
- **Writing a new collab/ecosystem file** → copy from `templates/collab-ecosystem.md`
- **Adding a `reminders/` directory to a skill** → use `sections/reminders.md` as its `_sections.md`

## Extending the Convention

To add a new content layer (e.g., `examples/`):
1. Add a new template to `templates/`
2. Update `structure/directory-layout.md`
3. Update this SKILL.md's "What's Here" section
Individual skills reference this skill — no changes needed in each of them.
