---
name: tailwind-v4-exp
description: Tailwind CSS v4 patterns and gotchas. ALWAYS consult this skill before writing any Tailwind utility class that needs !important, defining design tokens, or when an override "isn't working" — silent failure from wrong ! position is the #1 cause. Also use when setting up a new Tailwind v4 project, choosing between Tailwind v4 and alternatives, or debugging why @theme inline tokens don't generate utility classes.
license: MIT
metadata:
  author: ckbuilder-team
  version: "2.0.0"
---

# Tailwind CSS v4 Experience

Tailwind CSS v4 introduced breaking changes to token setup and the important modifier. These rules prevent silent failures.

## When to Apply

- Writing any Tailwind utility class that needs `!important`
- Defining design tokens in `globals.css`
- Debugging why a utility class override has no visible effect
- Setting up a new Tailwind v4 project
- Evaluating Tailwind v4 vs alternatives

## Best Practices

| Priority | Rule | Impact |
|----------|------|--------|
| 1 | `important-modifier` — `!` is a **suffix** in v4 (`px-2!` not `!px-2`); prefix form silently fails | HIGH |
| 2 | `theme-tokens` — `@theme inline` in `globals.css` auto-generates utility classes; no `tailwind.config.ts` needed | MEDIUM |

## Collab

- `collab/ecosystem.md` — Tailwind v4 + Antd, shadcn/ui, Next.js, Vite compatibility and trade-offs

## Creating New Content

For template formats and directory structure conventions, see `exp-blueprint`.
- New rule → `exp-blueprint/templates/best-practices-rule.md`
- New reminder → `exp-blueprint/templates/reminder.md`
- New collab file → `exp-blueprint/templates/collab-ecosystem.md`

## Related Skills

- `exp-blueprint` — Directory layout and template formats for all -exp skills
- `antd-exp` — Antd component override patterns using Tailwind utility classes
- `frontend-exp` — General React/Next.js principles including `styling-design-tokens`
