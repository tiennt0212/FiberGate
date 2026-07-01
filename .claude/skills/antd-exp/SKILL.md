---
name: antd-exp
description: Ant Design v5 patterns, gotchas, and ecosystem knowledge. ALWAYS consult this skill before passing any prop to Card, Button, Tag, Menu, or Table — especially if you're about to write bodyStyle, headStyle, or wrap a framework <Link> inside a menu item. Also use when applying Tailwind utility classes to override Antd styles, when an Antd component seems to ignore a className, or when evaluating whether to use Antd vs another component library.
license: MIT
metadata:
  author: ckbuilder-team
  version: "2.0.0"
---

# Ant Design Experience

Accumulated knowledge for working with Ant Design v5. Organized into three layers:

- **`best-practices/`** — Principles with rationale: WHY certain patterns exist, ❌/✅ examples
- **`reminders/`** — Quick lookup: deprecated API replacements, gotchas, one-liner fixes
- **`collab/`** — Ecosystem: which libraries work well with Antd, trade-offs vs alternatives

## When to Apply

- Before building any overlay, panel, accordion, dialog, tab bar, or dropdown — check the Antd catalog first
- Using `Card`, `Button`, `Tag`, `Menu`, `Table`, or other Antd components
- Applying Tailwind utility classes to override Antd default styles
- Passing a framework `<Link>` inside Antd `Menu` item labels
- Debugging why an Antd component ignores a `style` or `className` prop
- Evaluating whether to use Antd vs another component library

## Best Practices

| Priority | Rule | Impact |
|----------|------|--------|
| 1 | `component-overrides` | MEDIUM |
| 2 | `antd-button-not-raw-html` — Use `Button type="text"` for action items; raw `<button>` only when complex layout requires it | MEDIUM |

## Reminders

| Reminder | Type |
|---|---|
| `interactive-components-catalog` — Check Antd for Drawer/Collapse/Modal/Tabs before building custom HTML | gotcha |
| `deprecated-v5-apis` — `Card.bodyStyle` → `styles={{ body: ... }}` | api-change |
| `link-color-reset` — `text-inherit!` to reset `<Link>` color inside Menu items | gotcha |

## Collab

- `collab/ecosystem.md` — Antd + Tailwind, Next.js, Zustand, and trade-offs vs alternatives

## Creating New Content

For template formats and directory structure conventions, see `exp-blueprint`.
- New rule → `exp-blueprint/templates/best-practices-rule.md`
- New reminder → `exp-blueprint/templates/reminder.md`
- New collab file → `exp-blueprint/templates/collab-ecosystem.md`

## Related Skills

- `exp-blueprint` — Directory layout and template formats for all -exp skills
- `frontend-exp` — General React/Next.js principles (state, routing, Storybook, TypeScript)
- `tailwind-v4-exp` — `@theme inline` tokens and `!` suffix modifier
- `storybook-exp` — Mocking Next.js navigation in `@storybook/react-vite`
